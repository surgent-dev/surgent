import { db } from '@/lib/db'
import { HttpError } from '@/lib/errors'
import { config } from '@/lib/config'
import { PayClient } from '@/lib/pay/client'
import type { PayEnv } from '@/lib/pay/types'

export function requiredId(value: string | null, entity: string): string {
  if (value) return value
  throw new HttpError(500, `${entity} id is missing`)
}

export function metadataText(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}

export function toMinorAmount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function toDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export function normalizeAccountStatus(status: string): string {
  if (status === 'active' || status === 'verified') return 'connected'
  if (status === 'verification_failed') return 'restricted'
  return status
}

export function currencyFromCountry(country: string): string {
  return country === 'gb' ? 'gbp' : 'usd'
}

export function isSubscriptionActive(status: string): boolean {
  return status === 'active' || status === 'trialing'
}

export function extractProjectId(metadata: Record<string, unknown>): string | null {
  return typeof metadata.project_id === 'string' ? metadata.project_id : null
}

// --- Status monotonicity guards ---
// These prevent out-of-order webhooks from downgrading terminal states.

export function resolvePaymentStatus(current: string | null | undefined, next: string): string {
  if (current === 'succeeded') return 'succeeded'
  if (current === 'failed' && next !== 'succeeded') return 'failed'
  if (current === 'pending' && next === 'created') return 'pending'
  return next
}

export function resolveCheckoutStatus(current: string | null | undefined, next: string): string {
  if (current === 'completed') return 'completed'
  if (current === 'failed' && next !== 'completed') return 'failed'
  if (current === 'pending' && next === 'open') return 'pending'
  return next
}

export function resolveSubscriptionStatus(
  current: string | null | undefined,
  next: string,
): string {
  if (current === 'canceled') return 'canceled'
  return next
}

export function resolveRefundStatus(current: string | null | undefined, next: string): string {
  if (current === 'succeeded' || current === 'failed') return current
  return next
}

export function resolveDisputeStatus(current: string | null | undefined, next: string): string {
  if (current === 'won' || current === 'lost' || current === 'closed') return current
  return next
}

export function resolveInvoiceStatus(current: string | null | undefined, next: string): string {
  if (current === 'paid' || current === 'voided') return current
  return next
}

export function resolveBillingPeriod(
  interval: string | null | undefined,
  fallback?: number,
): number {
  if (fallback && Number.isFinite(fallback) && fallback > 0) return Math.floor(fallback)
  if (interval === 'day') return 1
  if (interval === 'week') return 7
  if (interval === 'year') return 365
  return 30
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const bytes = new Uint8Array(digest)
  const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function isNewerProduct(
  a: { version: number | null; createdAt?: Date },
  b: { version: number | null; createdAt?: Date },
): boolean {
  const av = a.version || 0
  const bv = b.version || 0
  if (av !== bv) return av > bv
  return Boolean(a.createdAt && (!b.createdAt || a.createdAt > b.createdAt))
}

export async function resolveActiveAccountId(
  projectId: string,
  env: PayEnv,
): Promise<string | null> {
  try {
    const account = await getAccountForProject({ projectId, env })
    return account.id
  } catch {
    return null
  }
}

export async function getProductsWithPrices(
  projectId: string,
  env: PayEnv,
  accountId?: string | null,
) {
  let query = db
    .selectFrom('product')
    .selectAll()
    .where('projectId', '=', projectId)
    .where('env', '=', env)

  if (accountId) {
    query = query.where((eb) =>
      eb.or([eb('accountId', '=', accountId), eb('accountId', 'is', null)]),
    )
  }

  const allRows = await query.execute()

  // Keep only latest version per product group
  const latestByGroup = new Map<string, (typeof allRows)[number]>()
  for (const row of allRows) {
    const current = latestByGroup.get(row.productGroup)
    if (!current || isNewerProduct(row, current)) {
      latestByGroup.set(row.productGroup, row)
    }
  }

  const products = [...latestByGroup.values()]
  const productIds = products.map((r) => requiredId(r.id, 'product'))

  const priceRows = productIds.length
    ? await db
        .selectFrom('product_price')
        .selectAll()
        .where('productId', 'in', productIds)
        .orderBy('createdAt', 'asc')
        .execute()
    : []

  const pricesByProduct = new Map<string, typeof priceRows>()
  for (const row of priceRows) {
    const list = pricesByProduct.get(row.productId) || []
    list.push(row)
    pricesByProduct.set(row.productId, list)
  }

  return { products, pricesByProduct }
}

export function getClient(env: PayEnv): PayClient {
  const { apiKey, platformCompanyId, baseUrl } = config.whop[env]
  if (!apiKey || !platformCompanyId) {
    throw new HttpError(500, `Whop ${env} configuration is missing`)
  }
  return new PayClient({ apiKey, platformCompanyId, baseUrl })
}

export async function getAccountForProject(args: {
  projectId?: string
  accountId?: string
  env: PayEnv
}) {
  if (!args.projectId && !args.accountId)
    throw new HttpError(400, 'projectId or accountId required')

  let query = db
    .selectFrom('pay_account')
    .selectAll()
    .where('status', '!=', 'disconnected')
    .where('env', '=', args.env)
  if (args.projectId) query = query.where('projectId', '=', args.projectId)
  if (args.accountId) query = query.where('id', '=', args.accountId)

  const row = await query.orderBy('createdAt', 'desc').executeTakeFirst()
  if (!row) throw new HttpError(404, 'Whop account not found')
  return row
}
