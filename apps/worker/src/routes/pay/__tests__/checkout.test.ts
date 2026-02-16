import { describe, test, expect, afterAll, beforeAll } from 'bun:test'
import { createClient } from '@repo/db'
import type { Database } from '@repo/db'
import type { Kysely } from 'kysely'

/**
 * Checkout idempotency tests.
 *
 * These test the idempotency and race-condition handling of pay_checkout_session
 * at the DB layer (INSERT ON CONFLICT, stale detection, failed cleanup).
 *
 * We don't go through the HTTP handler (that would require mocking auth + Whop API).
 * Instead we test the DB-level guarantees directly — the same logic the handler relies on.
 */

const DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://surgent:password@localhost:5432/surgent'

let db: Kysely<Database>
const TEST_PROJECT_ID = '00000000-0000-0000-0000-000000000001'
const TEST_USER_ID = '00000000-0000-0000-0000-000000000002'
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000003'
const TEST_ACCOUNT_ID = '00000000-0000-0000-0000-000000000004'
const createdCheckoutIds: string[] = []

beforeAll(async () => {
  const client = createClient(DATABASE_URL, 'postgres')
  db = client.db

  // Create prerequisite rows for FK constraints (idempotent)
  await db
    .insertInto('organization')
    .values({
      id: TEST_ORG_ID,
      name: 'Test Org',
      slug: 'test-checkout-org',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()

  await db
    .insertInto('user')
    .values({
      id: TEST_USER_ID,
      name: 'Test User',
      email: `checkout-test-${Date.now()}@test.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()

  await db
    .insertInto('project')
    .values({
      id: TEST_PROJECT_ID,
      userId: TEST_USER_ID,
      organizationId: TEST_ORG_ID,
      name: 'Test Project',
      slug: `test-checkout-proj-${Date.now()}`,
      status: 'provisioning',
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute()

  await db
    .insertInto('pay_account')
    .values({
      id: TEST_ACCOUNT_ID,
      projectId: TEST_PROJECT_ID,
      userId: TEST_USER_ID,
      whopCompanyId: `comp_checkout_test_${Date.now()}`,
      title: 'Test Account',
      status: 'connected',
      metadata: {},
      env: 'live',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflict((oc) => oc.columns(['projectId', 'userId', 'env']).doNothing())
    .execute()
})

afterAll(async () => {
  if (createdCheckoutIds.length > 0) {
    await db.deleteFrom('pay_checkout_session').where('id', 'in', createdCheckoutIds).execute()
  }
  // Clean up test fixtures (reverse FK order)
  await db.deleteFrom('pay_account').where('id', '=', TEST_ACCOUNT_ID).execute()
  await db.deleteFrom('project').where('id', '=', TEST_PROJECT_ID).execute()
  await db.deleteFrom('user').where('id', '=', TEST_USER_ID).execute()
  await db.deleteFrom('organization').where('id', '=', TEST_ORG_ID).execute()
  await db.destroy()
})

function makeCheckout(overrides?: Record<string, unknown>) {
  const id = crypto.randomUUID()
  createdCheckoutIds.push(id)
  return {
    id,
    projectId: TEST_PROJECT_ID,
    userId: TEST_USER_ID,
    accountId: TEST_ACCOUNT_ID,
    env: 'live',
    whopCompanyId: 'comp_test',
    whopCheckoutId: null as string | null,
    purchaseUrl: null as string | null,
    mode: 'payment',
    planType: 'one_time',
    status: 'creating',
    amount: 5000,
    currency: 'usd',
    idempotencyKey: null as string | null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// --- Unique constraint: (projectId, idempotencyKey) ---

describe('checkout idempotency key unique constraint', () => {
  test('same (projectId, idempotencyKey) → INSERT ON CONFLICT DO NOTHING', async () => {
    const idemKey = `idem_${Date.now()}`
    const checkout1 = makeCheckout({
      idempotencyKey: idemKey,
      status: 'open',
      whopCheckoutId: 'whop_1',
    })

    await db.insertInto('pay_checkout_session').values(checkout1).execute()

    // Second insert with same idempotency key — should conflict
    const checkout2 = makeCheckout({ idempotencyKey: idemKey })
    const result = await db
      .insertInto('pay_checkout_session')
      .values(checkout2)
      .onConflict((oc) => oc.columns(['projectId', 'idempotencyKey', 'env']).doNothing())
      .returning('id')
      .executeTakeFirst()

    expect(result).toBeUndefined() // conflict, nothing returned
  })

  test('null idempotencyKey allows multiple inserts (SQL NULL != NULL)', async () => {
    const checkout1 = makeCheckout({ idempotencyKey: null })
    const checkout2 = makeCheckout({ idempotencyKey: null })

    await db.insertInto('pay_checkout_session').values(checkout1).execute()
    await db.insertInto('pay_checkout_session').values(checkout2).execute()

    // Both should exist
    const rows = await db
      .selectFrom('pay_checkout_session')
      .select('id')
      .where('id', 'in', [checkout1.id, checkout2.id])
      .execute()

    expect(rows).toHaveLength(2)
  })
})

// --- Stale detection ---

describe('checkout stale detection', () => {
  test('creating status >60s old is stale', async () => {
    const idemKey = `stale_${Date.now()}`
    const staleTime = new Date(Date.now() - 120_000) // 2 minutes ago
    const checkout = makeCheckout({
      idempotencyKey: idemKey,
      status: 'creating',
      createdAt: staleTime,
    })

    await db.insertInto('pay_checkout_session').values(checkout).execute()

    // Query existing
    const existing = await db
      .selectFrom('pay_checkout_session')
      .select(['id', 'status', 'createdAt'])
      .where('projectId', '=', TEST_PROJECT_ID)
      .where('idempotencyKey', '=', idemKey)
      .executeTakeFirst()

    expect(existing).toBeDefined()
    const isStale =
      existing!.status === 'creating' && Date.now() - (existing!.createdAt?.getTime() ?? 0) > 60_000

    expect(isStale).toBe(true)

    // Delete stale + re-insert should work
    await db.deleteFrom('pay_checkout_session').where('id', '=', existing!.id).execute()

    const newCheckout = makeCheckout({
      idempotencyKey: idemKey,
      status: 'creating',
    })
    const inserted = await db
      .insertInto('pay_checkout_session')
      .values(newCheckout)
      .onConflict((oc) => oc.columns(['projectId', 'idempotencyKey', 'env']).doNothing())
      .returning('id')
      .executeTakeFirst()

    expect(inserted?.id).toBe(newCheckout.id)
  })

  test('creating status <60s old is NOT stale', async () => {
    const idemKey = `fresh_creating_${Date.now()}`
    const checkout = makeCheckout({
      idempotencyKey: idemKey,
      status: 'creating',
      createdAt: new Date(), // just now
    })

    await db.insertInto('pay_checkout_session').values(checkout).execute()

    const existing = await db
      .selectFrom('pay_checkout_session')
      .select(['id', 'status', 'createdAt'])
      .where('projectId', '=', TEST_PROJECT_ID)
      .where('idempotencyKey', '=', idemKey)
      .executeTakeFirst()

    const isStale =
      existing!.status === 'creating' && Date.now() - (existing!.createdAt?.getTime() ?? 0) > 60_000

    expect(isStale).toBe(false)
  })
})

// --- Failed checkout cleanup ---

describe('checkout failed cleanup', () => {
  test('failed checkout is deleted and slot freed for retry', async () => {
    const idemKey = `failed_${Date.now()}`
    const failedCheckout = makeCheckout({
      idempotencyKey: idemKey,
      status: 'failed',
    })

    await db.insertInto('pay_checkout_session').values(failedCheckout).execute()

    // Delete the failed row
    await db.deleteFrom('pay_checkout_session').where('id', '=', failedCheckout.id).execute()

    // New insert with same idempotency key should succeed
    const retryCheckout = makeCheckout({ idempotencyKey: idemKey, status: 'creating' })
    const inserted = await db
      .insertInto('pay_checkout_session')
      .values(retryCheckout)
      .onConflict((oc) => oc.columns(['projectId', 'idempotencyKey', 'env']).doNothing())
      .returning('id')
      .executeTakeFirst()

    expect(inserted?.id).toBe(retryCheckout.id)
  })

  test('open/completed checkout is NOT deleted on idempotent replay', async () => {
    const idemKey = `completed_${Date.now()}`
    const checkout = makeCheckout({
      idempotencyKey: idemKey,
      status: 'open',
      whopCheckoutId: 'whop_completed',
      purchaseUrl: 'https://pay.whop.com/checkout/whop_completed',
    })

    await db.insertInto('pay_checkout_session').values(checkout).execute()

    // Querying for replay: status is not 'failed' and not stale creating
    const existing = await db
      .selectFrom('pay_checkout_session')
      .select(['id', 'whopCheckoutId', 'purchaseUrl', 'status', 'createdAt'])
      .where('projectId', '=', TEST_PROJECT_ID)
      .where('idempotencyKey', '=', idemKey)
      .executeTakeFirst()

    const staleCreating =
      existing!.status === 'creating' && Date.now() - (existing!.createdAt?.getTime() ?? 0) > 60_000

    // Should return existing (not delete)
    expect(existing!.status !== 'failed' && !staleCreating).toBe(true)
    expect(existing!.whopCheckoutId).toBe('whop_completed')
    expect(existing!.purchaseUrl).toBe('https://pay.whop.com/checkout/whop_completed')
  })
})

// --- Status transitions ---

describe('checkout status transitions', () => {
  test('creating → open (Whop API success)', async () => {
    const checkout = makeCheckout({ status: 'creating' })
    await db.insertInto('pay_checkout_session').values(checkout).execute()

    await db
      .updateTable('pay_checkout_session')
      .set({
        whopCheckoutId: 'whop_success',
        purchaseUrl: 'https://pay.whop.com/checkout/whop_success',
        status: 'open',
        updatedAt: new Date(),
      })
      .where('id', '=', checkout.id)
      .execute()

    const row = await db
      .selectFrom('pay_checkout_session')
      .select(['status', 'whopCheckoutId', 'purchaseUrl'])
      .where('id', '=', checkout.id)
      .executeTakeFirst()

    expect(row?.status).toBe('open')
    expect(row?.whopCheckoutId).toBe('whop_success')
  })

  test('creating → failed (Whop API error)', async () => {
    const checkout = makeCheckout({ status: 'creating' })
    await db.insertInto('pay_checkout_session').values(checkout).execute()

    await db
      .updateTable('pay_checkout_session')
      .set({ status: 'failed', updatedAt: new Date() })
      .where('id', '=', checkout.id)
      .execute()

    const row = await db
      .selectFrom('pay_checkout_session')
      .select(['status', 'whopCheckoutId'])
      .where('id', '=', checkout.id)
      .executeTakeFirst()

    expect(row?.status).toBe('failed')
    expect(row?.whopCheckoutId).toBeNull()
  })

  test('open → completed (payment webhook updates)', async () => {
    const checkout = makeCheckout({
      status: 'open',
      whopCheckoutId: 'whop_completing',
    })
    await db.insertInto('pay_checkout_session').values(checkout).execute()

    const now = new Date()
    await db
      .updateTable('pay_checkout_session')
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where('id', '=', checkout.id)
      .execute()

    const row = await db
      .selectFrom('pay_checkout_session')
      .select(['status', 'completedAt'])
      .where('id', '=', checkout.id)
      .executeTakeFirst()

    expect(row?.status).toBe('completed')
    expect(row?.completedAt).toBeDefined()
  })
})

// --- Race condition: concurrent insert ---

describe('checkout concurrent insert race', () => {
  test('two concurrent inserts — one wins, other gets null', async () => {
    const idemKey = `race_${Date.now()}`

    // Simulate two concurrent inserts with same idempotency key
    const checkout1 = makeCheckout({ idempotencyKey: idemKey })
    const checkout2 = makeCheckout({ idempotencyKey: idemKey })

    const [result1, result2] = await Promise.all([
      db
        .insertInto('pay_checkout_session')
        .values(checkout1)
        .onConflict((oc) => oc.columns(['projectId', 'idempotencyKey', 'env']).doNothing())
        .returning('id')
        .executeTakeFirst(),
      db
        .insertInto('pay_checkout_session')
        .values(checkout2)
        .onConflict((oc) => oc.columns(['projectId', 'idempotencyKey', 'env']).doNothing())
        .returning('id')
        .executeTakeFirst(),
    ])

    // Exactly one should win
    const results = [result1, result2].filter(Boolean)
    expect(results).toHaveLength(1)

    // The winner's row should exist
    const winnerId = results[0]!.id
    const row = await db
      .selectFrom('pay_checkout_session')
      .select('id')
      .where('projectId', '=', TEST_PROJECT_ID)
      .where('idempotencyKey', '=', idemKey)
      .executeTakeFirst()

    expect(row?.id).toBe(winnerId)
  })
})
