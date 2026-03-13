import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('domain-reconciler')

/**
 * Runs every 5 minutes.
 * Finds domains stuck in transitional states for too long and logs warnings.
 */
export async function reconcileStuckDomains() {
  try {
    const stuckThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours

    const stuckDomains = await db
      .selectFrom('domain')
      .selectAll()
      .where('status', 'in', ['purchasing', 'dns_configuring'])
      .where('updatedAt', '<', stuckThreshold)
      .execute()

    for (const d of stuckDomains) {
      log.warn(
        { domainId: d.id, domainName: d.domainName, status: d.status, updatedAt: d.updatedAt },
        'Domain stuck in transitional state for >2 hours',
      )
    }

    // Mark unprocessed webhook events as failed after 2 hours
    const failedThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000)
    await db
      .updateTable('domain_webhook_event')
      .set({ status: 'failed', error: 'Timed out after 2 hours without processing' })
      .where('status', '=', 'pending')
      .where('createdAt', '<', failedThreshold)
      .execute()
  } catch (err) {
    log.error({ err }, 'domain reconciler cycle failed')
  }
}
