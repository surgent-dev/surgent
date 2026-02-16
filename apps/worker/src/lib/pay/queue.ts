import { PgBoss } from 'pg-boss'
import type { Job } from 'pg-boss'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { processWebhookEvent } from '@/routes/pay/handlers'
import type { ParsedWhopWebhookEvent, PayEnv } from './types'
import { createLogger } from '@/lib/logger'

const log = createLogger('pg-boss')

const QUEUE_NAME = 'webhook.process'
const DLQ_NAME = 'webhook.dead'

interface WebhookJobData {
  eventId: string
  eventType: string
  event: ParsedWhopWebhookEvent
  env: PayEnv
}

let boss: PgBoss | null = null

function getBoss(): PgBoss {
  if (!boss) {
    if (!config.database.url) throw new Error('DATABASE_URL not set')
    boss = new PgBoss({
      connectionString: config.database.url,
      max: 3,
    })
  }
  return boss
}

export async function startBoss(): Promise<void> {
  const b = getBoss()
  await b.start()

  b.on('error', (err: unknown) => {
    log.error({ err }, 'error')
  })

  await b.createQueue(DLQ_NAME, {
    retentionSeconds: 2_592_000, // 30 days
  })

  await b.createQueue(QUEUE_NAME, {
    retryLimit: 5,
    retryBackoff: true,
    expireInSeconds: 600, // 10 minutes
    retentionSeconds: 604800, // 7 days
    deadLetter: DLQ_NAME,
  })

  await b.work<WebhookJobData>(
    QUEUE_NAME,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<WebhookJobData>[]) => {
      for (const job of jobs) {
        const { eventId, eventType, event, env } = job.data
        const tag = `[QUEUE:whop:${env}]`

        log.info({ eventId, jobId: job.id }, `${tag} ${eventType} picked up from ${QUEUE_NAME}`)

        try {
          await processWebhookEvent(eventId, eventType, event, env)
          log.info({ eventId, jobId: job.id }, `${tag} ${eventType} completed`)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Webhook handling failed'

          log.error({ eventId, jobId: job.id, err }, `${tag} ${eventType} failed, will retry`)

          // Record error but keep status retryable — claim gate uses 'pending'|'failed'
          await db
            .updateTable('pay_webhook_event')
            .set({ error: message })
            .where('id', '=', eventId)
            .execute()

          throw err // let pg-boss handle retry
        }
      }
    },
  )

  // Mark events as permanently failed when they exhaust retries
  await b.work<WebhookJobData>(
    DLQ_NAME,
    { pollingIntervalSeconds: 30 },
    async (jobs: Job<WebhookJobData>[]) => {
      for (const job of jobs) {
        const { eventId, eventType, env } = job.data
        const tag = `[QUEUE:whop:${env}]`

        await db
          .updateTable('pay_webhook_event')
          .set({ status: 'failed', handledAt: new Date(), error: 'Exhausted all retries' })
          .where('id', '=', job.data.eventId)
          .execute()

        log.error({ eventId, jobId: job.id }, `${tag} ${eventType} exhausted retries → ${DLQ_NAME}`)
      }
    },
  )

  log.info({ queues: [QUEUE_NAME, DLQ_NAME] }, 'started, listening on queues')
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10_000 })
    log.info('stopped')
  }
}

export async function enqueueWebhookJob(
  eventId: string,
  eventType: string,
  event: ParsedWhopWebhookEvent,
  env: PayEnv,
): Promise<string | null> {
  const b = getBoss()
  return b.send(QUEUE_NAME, { eventId, eventType, event, env }, { singletonKey: eventId })
}
