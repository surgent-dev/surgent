import type { Job } from 'pg-boss'
import { getBoss } from '@/lib/boss'
import { createLogger } from '@/lib/logger'
import * as ProjectService from '@/services/projects'
import { runFulfillmentJob } from './fulfill'
import { createSnapshot } from './snapshot'
import type { FulfillmentJobData, SnapshotJobData } from './types'

const log = createLogger('marketplace-queue')

const FULFILL_QUEUE = 'marketplace.fulfill'
const FULFILL_DLQ = 'marketplace.fulfill.dead'
const SNAPSHOT_QUEUE = 'marketplace.snapshot'
const SNAPSHOT_DLQ = 'marketplace.snapshot.dead'

let registered = false

export async function registerMarketplaceWorkers(): Promise<void> {
  if (registered) return

  const boss = getBoss()

  await boss.createQueue(FULFILL_DLQ, {
    retentionSeconds: 2_592_000, // 30 days
  })

  await boss.createQueue(FULFILL_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
    expireInSeconds: 1_800, // 30 min
    retentionSeconds: 2_592_000,
    deadLetter: FULFILL_DLQ,
  })

  await boss.createQueue(SNAPSHOT_DLQ, {
    retentionSeconds: 2_592_000,
  })

  await boss.createQueue(SNAPSHOT_QUEUE, {
    retryLimit: 2,
    retryBackoff: true,
    expireInSeconds: 600, // 10 min
    retentionSeconds: 2_592_000,
    deadLetter: SNAPSHOT_DLQ,
  })

  await boss.work<FulfillmentJobData>(
    FULFILL_QUEUE,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<FulfillmentJobData>[]) => {
      for (const job of jobs) {
        log.info({ jobId: job.id, purchaseId: job.data.purchaseId }, 'fulfillment claimed')
        try {
          await runFulfillmentJob(job.data)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Fulfillment failed'
          await ProjectService.mergePurchaseFulfillment(job.data.purchaseId, {
            lastError: message,
          }).catch(() => {})
          throw err
        }
      }
    },
  )

  await boss.work<FulfillmentJobData>(
    FULFILL_DLQ,
    { pollingIntervalSeconds: 30 },
    async (jobs: Job<FulfillmentJobData>[]) => {
      for (const job of jobs) {
        const purchase = await ProjectService.getPurchaseById(job.data.purchaseId)
        const error =
          (purchase?.fulfillment as any)?.lastError || 'Fulfillment failed after retries'
        await ProjectService.updatePurchaseStatus(job.data.purchaseId, 'failed', error)
        log.error(
          { jobId: job.id, purchaseId: job.data.purchaseId },
          'fulfillment failed permanently',
        )
      }
    },
  )

  await boss.work<SnapshotJobData>(
    SNAPSHOT_QUEUE,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<SnapshotJobData>[]) => {
      for (const job of jobs) {
        log.info({ jobId: job.id, listingId: job.data.listingId }, 'snapshot creation claimed')
        await createSnapshot(job.data.listingId, job.data.projectId)
      }
    },
  )

  await boss.work<SnapshotJobData>(
    SNAPSHOT_DLQ,
    { pollingIntervalSeconds: 30 },
    async (jobs: Job<SnapshotJobData>[]) => {
      for (const job of jobs) {
        log.error(
          { jobId: job.id, listingId: job.data.listingId },
          'snapshot creation failed permanently',
        )
      }
    },
  )

  registered = true
  log.info(
    { queues: [FULFILL_QUEUE, FULFILL_DLQ, SNAPSHOT_QUEUE, SNAPSHOT_DLQ] },
    'marketplace workers registered',
  )
}

export async function enqueueFulfillmentJob(data: FulfillmentJobData): Promise<string | null> {
  return getBoss().send(FULFILL_QUEUE, data, {
    singletonKey: data.purchaseId,
  })
}

export async function enqueueSnapshotJob(data: SnapshotJobData): Promise<string | null> {
  return getBoss().send(SNAPSHOT_QUEUE, data, {
    singletonKey: data.listingId,
  })
}
