import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import * as MarketplaceService from '@/services/marketplace'
import { enqueueMarketplaceFulfillmentJob } from '@/lib/marketplace/queue'

const log = createLogger('marketplace-trigger')

export async function triggerMarketplaceFulfillment(
  checkoutId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const snapshotId = metadata.snapshot_id as string | undefined
  const listingId = metadata.listing_id as string | undefined

  // Not a marketplace purchase if these are missing
  if (!snapshotId || !listingId) return

  // Idempotency: check if purchase already exists for this checkout
  const existing = await MarketplaceService.getPurchaseByCheckoutId(checkoutId)
  if (existing) {
    log.info({ checkoutId, purchaseId: existing.id }, 'purchase already exists, skipping')
    return
  }

  // Get checkout session for buyer info
  const checkout = await db
    .selectFrom('pay_checkout_session')
    .select(['id', 'userId', 'projectId'])
    .where('id', '=', checkoutId)
    .executeTakeFirst()

  if (!checkout?.userId) {
    log.warn({ checkoutId }, 'checkout session or userId not found')
    return
  }

  // Resolve buyer's organization
  const member = await db
    .selectFrom('member')
    .select('organizationId')
    .where('userId', '=', checkout.userId)
    .executeTakeFirst()

  if (!member) {
    log.warn({ checkoutId, userId: checkout.userId }, 'buyer has no organization membership')
    return
  }

  // Look up listing for seller project
  const listing = await db
    .selectFrom('listing')
    .select(['id', 'projectId'])
    .where('id', '=', listingId)
    .executeTakeFirst()

  if (!listing) {
    log.warn({ checkoutId, listingId }, 'listing not found')
    return
  }

  // Create purchase record
  const purchase = await MarketplaceService.createPurchase({
    listingId: listing.id!,
    snapshotId,
    buyerUserId: checkout.userId,
    buyerOrgId: member.organizationId,
    sellerProjectId: listing.projectId,
    checkoutId,
  })

  // Enqueue fulfillment job
  await enqueueMarketplaceFulfillmentJob({
    purchaseId: purchase.id,
    snapshotId,
    buyerUserId: checkout.userId,
    buyerOrgId: member.organizationId,
    sellerProjectId: listing.projectId,
    listingId: listing.id!,
  })

  log.info(
    { checkoutId, purchaseId: purchase.id, listingId, snapshotId },
    'marketplace fulfillment triggered',
  )
}
