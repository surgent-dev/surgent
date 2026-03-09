import type { Job } from 'pg-boss'
import { db } from '@/lib/db'
import { getBoss } from '@/lib/boss'
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

let registered = false

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Webhook handling failed'
}

function isPermanentWebhookError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const code = 'code' in err && typeof err.code === 'string' ? err.code : null
  const status = 'status' in err && typeof err.status === 'number' ? err.status : null
  const table = 'table' in err && typeof err.table === 'string' ? err.table : null
  const constraint =
    'constraint' in err && typeof err.constraint === 'string' ? err.constraint : null

  if (code === '22P02' || code === '42P18') return true
  if (
    code === '23503' &&
    table === 'pay_customer' &&
    constraint === 'pay_customer_projectId_fkey'
  ) {
    return true
  }
  if (status && status >= 400 && status < 500 && ![408, 409, 429].includes(status)) return true

  return false
}

export async function registerPayWorkers(): Promise<void> {
  if (registered) return

  const b = getBoss()

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
          const message = getErrorMessage(err)
          if (isPermanentWebhookError(err)) {
            log.error({ eventId, jobId: job.id, err }, `${tag} ${eventType} failed permanently`)
            await db
              .updateTable('pay_webhook_event')
              .set({ status: 'failed', handledAt: new Date(), error: message })
              .where('id', '=', eventId)
              .execute()
            continue
          }

          log.error({ eventId, jobId: job.id, err }, `${tag} ${eventType} failed, will retry`)

          await db
            .updateTable('pay_webhook_event')
            .set({ error: message })
            .where('id', '=', eventId)
            .execute()

          throw err
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
        const current = await db
          .selectFrom('pay_webhook_event')
          .select(['error'])
          .where('id', '=', eventId)
          .executeTakeFirst()

        await db
          .updateTable('pay_webhook_event')
          .set({
            status: 'failed',
            handledAt: new Date(),
            error: current?.error || 'Exhausted all retries',
          })
          .where('id', '=', job.data.eventId)
          .execute()

        log.error({ eventId, jobId: job.id }, `${tag} ${eventType} exhausted retries → ${DLQ_NAME}`)
      }
    },
  )

  registered = true
  log.info({ queues: [QUEUE_NAME, DLQ_NAME] }, 'pay workers registered')
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
