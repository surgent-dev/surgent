import { db } from '@/lib/db'
import type { MarketplacePurchaseStatus } from '@repo/db'

// ── Snapshot CRUD ──────────────────────────────────────────────────────────

export async function createSnapshot(args: {
  projectId: string
  storageKey: string
  sizeBytes: number
}) {
  const prev = await getLatestSnapshotForProject(args.projectId)
  const version = (prev?.version ?? 0) + 1

  const row = await db
    .insertInto('marketplace_snapshot')
    .values({
      projectId: args.projectId,
      storageKey: args.storageKey,
      sizeBytes: args.sizeBytes,
      version,
    })
    .returning(['id', 'version'])
    .executeTakeFirstOrThrow()

  return { id: row.id as string, version: row.version as number }
}

export function getSnapshotById(id: string) {
  return db.selectFrom('marketplace_snapshot').selectAll().where('id', '=', id).executeTakeFirst()
}

export function getLatestSnapshotForProject(projectId: string) {
  return db
    .selectFrom('marketplace_snapshot')
    .selectAll()
    .where('projectId', '=', projectId)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst()
}

// ── Purchase CRUD ──────────────────────────────────────────────────────────

export async function createPurchase(args: {
  listingId: string
  snapshotId: string
  buyerUserId: string
  buyerOrgId: string
  sellerProjectId: string
  checkoutId?: string | null
}) {
  const now = new Date()
  const row = await db
    .insertInto('marketplace_purchase')
    .values({
      listingId: args.listingId,
      snapshotId: args.snapshotId,
      buyerUserId: args.buyerUserId,
      buyerOrgId: args.buyerOrgId,
      sellerProjectId: args.sellerProjectId,
      checkoutId: args.checkoutId ?? null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  return { id: row.id as string }
}

export function getPurchaseById(id: string) {
  return db.selectFrom('marketplace_purchase').selectAll().where('id', '=', id).executeTakeFirst()
}

export function getPurchaseByCheckoutId(checkoutId: string) {
  return db
    .selectFrom('marketplace_purchase')
    .selectAll()
    .where('checkoutId', '=', checkoutId)
    .executeTakeFirst()
}

export function getPurchaseByBuyerAndListing(buyerUserId: string, listingId: string) {
  return db
    .selectFrom('marketplace_purchase')
    .selectAll()
    .where('buyerUserId', '=', buyerUserId)
    .where('listingId', '=', listingId)
    .executeTakeFirst()
}

export function getPurchasesByBuyerUserId(buyerUserId: string) {
  return db
    .selectFrom('marketplace_purchase')
    .selectAll()
    .where('buyerUserId', '=', buyerUserId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export async function updatePurchaseStatus(
  id: string,
  status: MarketplacePurchaseStatus,
  extra?: {
    buyerProjectId?: string
    failReason?: string
    step?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const set: Record<string, unknown> = { status, updatedAt: new Date() }
  if (extra?.buyerProjectId !== undefined) set.buyerProjectId = extra.buyerProjectId
  if (extra?.failReason !== undefined) set.failReason = extra.failReason
  if (extra?.step !== undefined) set.step = extra.step
  if (extra?.metadata !== undefined) set.metadata = extra.metadata

  await db.updateTable('marketplace_purchase').set(set).where('id', '=', id).execute()
}

export async function updatePurchaseMetadata(id: string, metadata: Record<string, unknown>) {
  const purchase = await getPurchaseById(id)
  const current = (purchase?.metadata || {}) as Record<string, unknown>
  const merged = { ...current, ...metadata }

  await db
    .updateTable('marketplace_purchase')
    .set({ metadata: merged, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

// ── Listing snapshot link ──────────────────────────────────────────────────

export async function updateListingSnapshotId(listingId: string, snapshotId: string) {
  await db
    .updateTable('listing')
    .set({ snapshotId, updatedAt: new Date() })
    .where('id', '=', listingId)
    .execute()
}
