import { db } from '@repo/db'
import { sql } from 'kysely'
import type Whop from '@whop/sdk'

export function calculatePlatformFee(amount: number, bps: number, fixed: number): number {
  const percentageFee = Math.floor(amount * bps / 10000)
  return Math.max(percentageFee, fixed)
}

export function calculatePayoutAmount(grossAmount: number, bps: number, fixed: number): number {
  return grossAmount - calculatePlatformFee(grossAmount, bps, fixed)
}

export async function getMerchant(id: string) {
  return db
    .selectFrom('merchants')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function createMerchant(params: {
  id: string
  name: string
  email?: string
  whopCompanyId?: string
}) {
  return db
    .insertInto('merchants')
    .values({
      id: params.id,
      name: params.name,
      email: params.email ?? null,
      whopCompanyId: params.whopCompanyId ?? null,
      metadata: null,
    })
    .returning(['id', 'name', 'whopCompanyId'])
    .executeTakeFirstOrThrow()
}

export async function updateMerchantWhopCompanyId(id: string, whopCompanyId: string) {
  await db
    .updateTable('merchants')
    .set({ whopCompanyId })
    .where('id', '=', id)
    .execute()
}

export async function createProduct(params: {
  merchantId: string
  projectId: string
  title: string
  slug: string
  description?: string
  previewUrl?: string
  thumbnailUrl?: string
}) {
  const metadata: Record<string, string> = {}
  if (params.previewUrl) metadata.previewUrl = params.previewUrl
  if (params.thumbnailUrl) metadata.thumbnailUrl = params.thumbnailUrl

  return db
    .insertInto('products')
    .values({
      merchantId: params.merchantId,
      projectId: params.projectId,
      title: params.title,
      slug: params.slug,
      description: params.description ?? null,
      status: 'active',
      metadata: Object.keys(metadata).length ? metadata : null,
    })
    .returning(['id', 'merchantId', 'projectId', 'title', 'slug', 'status', 'metadata'])
    .executeTakeFirstOrThrow()
}

export async function getProductsByMerchantId(merchantId: string) {
  return db
    .selectFrom('products')
    .selectAll()
    .where('merchantId', '=', merchantId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export async function getProductById(productId: string) {
  return db
    .selectFrom('products')
    .selectAll()
    .where('id', '=', productId)
    .executeTakeFirst()
}

export async function getProductWithMerchant(productId: string) {
  return db
    .selectFrom('products')
    .innerJoin('merchants', 'merchants.id', 'products.merchantId')
    .select([
      'products.id',
      'products.merchantId',
      'products.projectId',
      'products.title',
      'products.slug',
      'products.description',
      'products.status',
      'products.metadata',
      'products.createdAt',
      'merchants.name as merchantName',
    ])
    .where('products.id', '=', productId)
    .executeTakeFirst()
}

export async function getProductByProjectId(projectId: string) {
  return db
    .selectFrom('products')
    .selectAll()
    .where('projectId', '=', projectId)
    .executeTakeFirst()
}

export async function updateProduct(
  productId: string,
  params: {
    title?: string
    description?: string
    previewUrl?: string | null
    thumbnailUrl?: string | null
  }
) {
  const updates: Record<string, unknown> = {}

  if (params.title !== undefined) updates.title = params.title
  if (params.description !== undefined) updates.description = params.description

  if (params.previewUrl !== undefined || params.thumbnailUrl !== undefined) {
    const current = await db
      .selectFrom('products')
      .select(['metadata'])
      .where('id', '=', productId)
      .executeTakeFirst()

    const metadata = { ...(current?.metadata ?? {}) }

    if (params.previewUrl !== undefined) {
      if (params.previewUrl) metadata.previewUrl = params.previewUrl
      else delete metadata.previewUrl
    }
    if (params.thumbnailUrl !== undefined) {
      if (params.thumbnailUrl) metadata.thumbnailUrl = params.thumbnailUrl
      else delete metadata.thumbnailUrl
    }

    updates.metadata = Object.keys(metadata).length ? metadata : null
  }

  if (Object.keys(updates).length === 0) return null

  return db
    .updateTable('products')
    .set(updates)
    .where('id', '=', productId)
    .returning(['id', 'merchantId', 'projectId', 'title', 'slug', 'description', 'status', 'metadata'])
    .executeTakeFirst()
}

export async function getAllProducts() {
  return db
    .selectFrom('products')
    .innerJoin('merchants', 'merchants.id', 'products.merchantId')
    .leftJoin('product_prices', (join) =>
      join
        .onRef('product_prices.productId', '=', 'products.id')
        .on('product_prices.active', '=', true)
    )
    .select([
      'products.id',
      'products.merchantId',
      'products.projectId',
      'products.title',
      'products.slug',
      'products.description',
      'products.status',
      'products.metadata',
      'products.createdAt',
      'merchants.name as merchantName',
      'product_prices.id as priceId',
      'product_prices.amount as priceAmount',
      'product_prices.currency as priceCurrency',
      'product_prices.code as priceCode',
    ])
    .where('products.status', '=', 'active')
    .orderBy('products.createdAt', 'desc')
    .execute()
}

export async function createProductPrice(params: {
  productId: string
  code: string
  amount: number
  currency: string
}) {
  return db
    .insertInto('product_prices')
    .values({
      productId: params.productId,
      code: params.code,
      amount: params.amount,
      currency: params.currency,
      active: true,
      metadata: null,
    })
    .returning(['id', 'productId', 'code', 'amount', 'currency', 'active'])
    .executeTakeFirstOrThrow()
}

export async function getActivePricesByProductId(productId: string) {
  return db
    .selectFrom('product_prices')
    .selectAll()
    .where('productId', '=', productId)
    .where('active', '=', true)
    .execute()
}

export async function getPriceById(priceId: string) {
  return db
    .selectFrom('product_prices')
    .selectAll()
    .where('id', '=', priceId)
    .executeTakeFirst()
}

export async function createOrder(params: {
  merchantId: string
  customerId: string
  productId: string
  priceId: string
  amount: number
  currency: string
  metadata?: Record<string, unknown>
}) {
  return db
    .insertInto('orders')
    .values({
      merchantId: params.merchantId,
      customerId: params.customerId,
      productId: params.productId,
      priceId: params.priceId,
      amount: params.amount,
      currency: params.currency,
      status: 'pending',
      whopPaymentId: null,
      whopPaymentStatus: null,
      metadata: params.metadata ?? null,
    })
    .returning(['id', 'merchantId', 'customerId', 'productId', 'priceId', 'amount', 'currency', 'status'])
    .executeTakeFirstOrThrow()
}

export async function getOrderById(orderId: string) {
  return db
    .selectFrom('orders')
    .selectAll()
    .where('id', '=', orderId)
    .executeTakeFirst()
}

export async function updateOrderPayment(
  orderId: string,
  whopPaymentId: string,
  whopPaymentStatus: string,
  status: string
) {
  await db
    .updateTable('orders')
    .set({
      whopPaymentId,
      whopPaymentStatus,
      status,
    })
    .where('id', '=', orderId)
    .execute()
}

export async function insertWebhookEvent(params: {
  webhookId: string
  type: string
  whopCompanyId?: string
  payload: unknown
}) {
  const result = await db
    .insertInto('whop_webhook_events')
    .values({
      webhookId: params.webhookId,
      type: params.type,
      whopCompanyId: params.whopCompanyId ?? null,
      payload: params.payload,
      status: 'pending',
      attempts: 0,
      error: null,
    })
    .onConflict((oc) => oc.column('webhookId').doNothing())
    .returning(['id', 'webhookId'])
    .executeTakeFirst()

  return result // null if conflict (duplicate)
}

export async function claimWebhookEvent(webhookId: string) {
  // Atomically claim: pending -> processing
  const result = await db
    .updateTable('whop_webhook_events')
    .set({
      status: 'processing',
      attempts: sql`attempts + 1`,
      error: null,
    })
    .where('webhookId', '=', webhookId)
    .where('status', 'in', ['pending', 'failed'])
    .returning(['id', 'webhookId', 'type', 'payload', 'status'])
    .executeTakeFirst()

  return result // null if already claimed/processed
}

export async function getWebhookEventByWebhookId(webhookId: string) {
  return db
    .selectFrom('whop_webhook_events')
    .selectAll()
    .where('webhookId', '=', webhookId)
    .executeTakeFirst()
}

export async function markWebhookEventProcessed(webhookId: string) {
  await db
    .updateTable('whop_webhook_events')
    .set({
      status: 'processed',
      processedAt: sql`now()`,
    })
    .where('webhookId', '=', webhookId)
    .execute()
}

export async function markWebhookEventFailed(webhookId: string, error: string) {
  await db
    .updateTable('whop_webhook_events')
    .set({
      status: 'failed',
      error,
    })
    .where('webhookId', '=', webhookId)
    .execute()
}

export async function createTransferRecord(params: {
  orderId: string
  idempotencyKey: string
  originWhopCompanyId: string
  destinationWhopCompanyId: string
  amount: number
  currency: string
}) {
  const result = await db
    .insertInto('whop_transfers')
    .values({
      orderId: params.orderId,
      idempotencyKey: params.idempotencyKey,
      originWhopCompanyId: params.originWhopCompanyId,
      destinationWhopCompanyId: params.destinationWhopCompanyId,
      amount: params.amount,
      currency: params.currency,
      status: 'pending',
      whopTransferId: null,
      raw: null,
    })
    .onConflict((oc) => oc.column('idempotencyKey').doNothing())
    .returning(['id', 'orderId', 'idempotencyKey', 'status'])
    .executeTakeFirst()

  return result // null if conflict (duplicate)
}

export async function updateTransferSuccess(idempotencyKey: string, whopTransferId: string, raw?: unknown) {
  await db
    .updateTable('whop_transfers')
    .set({
      whopTransferId,
      status: 'succeeded',
      raw: raw ?? null,
    })
    .where('idempotencyKey', '=', idempotencyKey)
    .execute()
}

export async function updateTransferFailed(idempotencyKey: string, error: string) {
  await db
    .updateTable('whop_transfers')
    .set({
      status: 'failed',
      raw: { error },
    })
    .where('idempotencyKey', '=', idempotencyKey)
    .execute()
}

export async function getTransferByOrderId(orderId: string) {
  return db
    .selectFrom('whop_transfers')
    .selectAll()
    .where('orderId', '=', orderId)
    .executeTakeFirst()
}

export async function processPaymentSucceeded(
  whop: Whop,
  platformCompanyId: string,
  paymentId: string,
  orderId: string,
  platformFeeBps: number,
  platformFeeFixed: number
) {
  // 1. Get order
  const order = await getOrderById(orderId)
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  // 2. Check if already processed
  if (order.status === 'paid' || order.status === 'fulfilled') {
    return { alreadyProcessed: true, order }
  }

  // 3. Get merchant
  const merchant = await getMerchant(order.merchantId)
  if (!merchant?.whopCompanyId) {
    throw new Error(`Merchant not found or no Whop company: ${order.merchantId}`)
  }

  // 4. Update order as paid
  await updateOrderPayment(orderId, paymentId, 'succeeded', 'paid')

  // 5. Calculate payout amount
  const payoutAmount = calculatePayoutAmount(order.amount, platformFeeBps, platformFeeFixed)

  // 6. Create transfer record with idempotency key
  const idempotencyKey = `transfer_${paymentId}`
  const transferRecord = await createTransferRecord({
    orderId,
    idempotencyKey,
    originWhopCompanyId: platformCompanyId,
    destinationWhopCompanyId: merchant.whopCompanyId,
    amount: payoutAmount,
    currency: order.currency,
  })

  // If transfer record already exists (duplicate), skip
  if (!transferRecord) {
    return { alreadyProcessed: true, order }
  }

  // 7. Call Whop to create transfer
  try {
    const transfer = await whop.transfers.create({
      origin_id: platformCompanyId,
      destination_id: merchant.whopCompanyId,
      amount: payoutAmount,
      currency: order.currency.toLowerCase() as Whop.Currency,
      idempotence_key: idempotencyKey,
      metadata: { orderId, paymentId },
    })

    // 8. Mark transfer as succeeded
    await updateTransferSuccess(idempotencyKey, transfer.id, transfer)

    return { alreadyProcessed: false, order, transfer }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await updateTransferFailed(idempotencyKey, errorMsg)
    throw err
  }
}

export async function processPaymentFailed(paymentId: string, orderId: string) {
  const order = await getOrderById(orderId)
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  if (order.status === 'failed') {
    return { alreadyProcessed: true, order }
  }

  await updateOrderPayment(orderId, paymentId, 'failed', 'failed')
  return { alreadyProcessed: false, order }
}
