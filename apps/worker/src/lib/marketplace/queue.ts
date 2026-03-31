import type { Job } from 'pg-boss'
import {
  runMarketplaceFulfillmentJob,
  type FulfillmentJobData,
} from '@/controllers/marketplace-fulfill'
import { getBoss } from '@/lib/boss'
import { createLogger } from '@/lib/logger'
import * as MarketplaceService from '@/services/marketplace'

const log = createLogger('marketplace-queue')

const FULFILL_QUEUE = 'marketplace.fulfill'
const FULFILL_DLQ = 'marketplace.fulfill.dead'

let registered = false

export async function registerMarketplaceWorkers(): Promise<void> {
  if (registered) return

  const boss = getBoss()

  await boss.createQueue(FULFILL_DLQ, {
    retentionSeconds: 2_592_000, // 30 days
  })

  await boss.createQueue(FULFILL_QUEUE, {
    retryLimit: 2,
    retryBackoff: true,
    expireInSeconds: 1_800, // 30 min
    retentionSeconds: 604_800, // 7 days
    deadLetter: FULFILL_DLQ,
  })

  await boss.work<FulfillmentJobData>(
    FULFILL_QUEUE,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<FulfillmentJobData>[]) => {
      for (const job of jobs) {
        log.info({ jobId: job.id, purchaseId: job.data.purchaseId }, 'marketplace fulfill claimed')
        try {
          await runMarketplaceFulfillmentJob(job.data)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Fulfillment failed'
          await MarketplaceService.updatePurchaseStatus(job.data.purchaseId, 'failed', {
            failReason: message,
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
        const purchase = await MarketplaceService.getPurchaseById(job.data.purchaseId)
        if (purchase?.status === 'ready') continue
        await MarketplaceService.updatePurchaseStatus(job.data.purchaseId, 'failed', {
          failReason: purchase?.failReason || 'Fulfillment failed after retries',
        })
        log.error(
          { jobId: job.id, purchaseId: job.data.purchaseId },
          'marketplace fulfill failed permanently',
        )
      }
    },
  )

  registered = true
  log.info({ queues: [FULFILL_QUEUE, FULFILL_DLQ] }, 'marketplace workers registered')
}

export async function enqueueMarketplaceFulfillmentJob(
  data: FulfillmentJobData,
): Promise<string | null> {
  return getBoss().send(FULFILL_QUEUE, data, {
    singletonKey: data.purchaseId,
  })
}
