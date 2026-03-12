import type Stripe from 'stripe'
import { sql } from 'kysely'
import { db } from './db'
import { config } from './config'
import { stripe } from './stripe'

export type BillingTier = 'free' | 'pro'
export type BillingInterval = 'month' | 'year' | null
export type BillingSyncKind = 'subscription' | 'topup' | null
export type BillingFeatureId =
  | 'projects'
  | 'private_projects'
  | 'publish_your_app'
  | 'download_code'
  | 'ai_credits'

export type TopupPaymentIntentResult =
  | {
      mode: 'charged'
      snapshot: BillingSnapshot
    }
  | {
      mode: 'checkout'
      url: string
      error?: string | null
    }

type BillingBucket = 'included' | 'prepaid'
type BillingLedgerKind =
  | 'subscription_allowance'
  | 'topup_purchase'
  | 'auto_reload'
  | 'usage_debit'
  | 'refund'
  | 'manual_adjustment'
  | 'reward'

type PlanConfig = {
  tier: BillingTier
  label: string
  interval: BillingInterval
  priceId: string | null
  priceUsd: number
  monthlyAllowanceMicros: number
  projectsLimit: number | null
  privateProjects: boolean
  publishYourApp: boolean
  downloadCode: boolean
}

type CatalogDisplay = {
  billingOptions: Array<{
    tier: BillingTier
    label: string
    interval: BillingInterval
    priceUsd: number
    priceLabel: string
    monthlyAllowanceMicros: number
    monthlyAllowanceLabel: string
  }>
}

type BillingSnapshot = {
  organizationId: string
  stripeCustomerId: string | null
  tier: BillingTier
  interval: BillingInterval
  status: string
  trialEnd: string | null
  currentPeriodEnd: string | null
  nextAllowanceGrantAt: string | null
  cancelAtPeriodEnd: boolean
  includedBalanceMicros: number
  prepaidBalanceMicros: number
  totalBalanceMicros: number
  totalBudgetMicros: number
  usedMicros: number
  usedPercent: number
  monthlyAllowanceMicros: number
  monthlySpendLimitMicros: number
  paymentMethodBrand: string | null
  paymentMethodLast4: string | null
  stripeCouponId: string | null
  stripeDiscountId: string | null
  stripePromotionCodeId: string | null
  topupMinUsd: number
  features: {
    projectsLimit: number | null
    privateProjects: boolean
    publishYourApp: boolean
    downloadCode: boolean
    canUseAi: boolean
  }
  billingOptions: CatalogDisplay['billingOptions']
}

type BillingStateRow = {
  account: {
    id: string
    organizationId: string
    stripeCustomerId: string | null
    defaultPaymentMethodId: string | null
    paymentMethodBrand: string | null
    paymentMethodLast4: string | null
    includedBalanceMicros: string | number
    prepaidBalanceMicros: string | number
    autoReloadEnabled: boolean
    autoReloadThresholdMicros: string | number | null
    autoReloadAmountMicros: string | number | null
    monthlySpendLimitMicros: string | number | null
    currency: string
  }
  subscription: {
    id: string
    organizationId: string
    stripeSubscriptionId: string | null
    stripePriceId: string | null
    tier: string
    interval: string | null
    status: string
    trialStart: Date | null
    trialEnd: Date | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
    canceledAt: Date | null
    monthlyAllowanceMicros: string | number
    nextAllowanceGrantAt: Date | null
    stripeCouponId: string | null
    stripeDiscountId: string | null
    stripePromotionCodeId: string | null
  }
}

const MONEY_SCALE = 100_000_000
const ALLOWANCE_STATUSES = new Set(['trialing', 'active'])

function dollarsToMicros(value: number) {
  return Math.round(value * MONEY_SCALE)
}

function microsToDollars(value: number) {
  return value / MONEY_SCALE
}

function asNumber(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return Number(value)
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

function resolveBillingReturnUrl(returnPath?: string | null) {
  const fallback = new URL('/dashboard', config.server.clientOrigin)
  if (!returnPath) return fallback.toString()
  if (!returnPath.startsWith('/') || returnPath.startsWith('//')) return fallback.toString()

  try {
    return new URL(returnPath, config.server.clientOrigin).toString()
  } catch {
    return fallback.toString()
  }
}

export const planCatalog: PlanConfig[] = [
  {
    tier: 'free',
    label: 'Free',
    interval: null,
    priceId: null,
    priceUsd: 0,
    monthlyAllowanceMicros: dollarsToMicros(config.stripe.free.allowanceUsd),
    projectsLimit: 3,
    privateProjects: false,
    publishYourApp: false,
    downloadCode: false,
  },
  {
    tier: 'pro',
    label: 'Pro Monthly',
    interval: 'month',
    priceId: config.stripe.pro.month.priceId ?? null,
    priceUsd: config.stripe.pro.month.priceUsd,
    monthlyAllowanceMicros: dollarsToMicros(config.stripe.pro.month.allowanceUsd),
    projectsLimit: null,
    privateProjects: true,
    publishYourApp: true,
    downloadCode: true,
  },
  {
    tier: 'pro',
    label: 'Pro Yearly',
    interval: 'year',
    priceId: config.stripe.pro.year.priceId ?? null,
    priceUsd: config.stripe.pro.year.priceUsd,
    monthlyAllowanceMicros: dollarsToMicros(config.stripe.pro.year.allowanceUsd),
    projectsLimit: null,
    privateProjects: true,
    publishYourApp: true,
    downloadCode: true,
  },
]

const freePlan = (() => {
  const plan = planCatalog.find((item) => item.tier === 'free' && item.interval === null)
  if (!plan) throw new Error('Missing free billing plan config')
  return plan
})()

function requireStripe() {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe
}

function getPlanConfig(tier: string, interval: string | null = null): PlanConfig {
  const match = planCatalog.find((item) => item.tier === tier && item.interval === interval)
  if (match) return match
  if (tier === 'free') return freePlan
  throw new Error(`Unknown billing tier: ${tier}:${interval ?? 'none'}`)
}

function getPlanFromPriceId(priceId: string | null | undefined): PlanConfig {
  const match = planCatalog.find((item) => item.priceId && item.priceId === priceId)
  // TODO: Support legacy Stripe price ids via metadata or a local mapping table.
  if (!match) throw new Error(`Unknown Stripe price ID: ${priceId}`)
  return match
}

function centsToMicros(value: number) {
  return Math.round(value * 1_000_000)
}

function getDiscountIds(discounts: Array<string | Stripe.Discount | Stripe.DeletedDiscount> = []) {
  const discount = discounts[0]
  if (!discount) {
    return {
      stripeDiscountId: null,
      stripeCouponId: null,
      stripePromotionCodeId: null,
    }
  }

  if (typeof discount === 'string') {
    return {
      stripeDiscountId: discount,
      stripeCouponId: null,
      stripePromotionCodeId: null,
    }
  }

  const coupon = discount.source?.coupon
  const promotionCode = discount.promotion_code

  return {
    stripeDiscountId: discount.id,
    stripeCouponId: typeof coupon === 'string' ? coupon : (coupon?.id ?? null),
    stripePromotionCodeId:
      typeof promotionCode === 'string' ? promotionCode : (promotionCode?.id ?? null),
  }
}

function allowanceEligible(row: BillingStateRow['subscription']) {
  if (row.tier === 'free') return true
  return ALLOWANCE_STATUSES.has(row.status)
}

function nextAllowanceDate(anchor: Date) {
  return addMonths(anchor, 1)
}

function getUsagePeriodStart(
  row: Pick<BillingStateRow['subscription'], 'currentPeriodStart' | 'nextAllowanceGrantAt'>,
  now = new Date(),
) {
  if (row.nextAllowanceGrantAt) return addMonths(row.nextAllowanceGrantAt, -1)
  return row.currentPeriodStart ?? startOfMonth(now)
}

function getCatalogDisplay(): CatalogDisplay {
  return {
    billingOptions: planCatalog
      .filter((item) => item.tier === 'free' || item.priceId)
      .map((item) => ({
        tier: item.tier,
        label: item.label,
        interval: item.interval,
        priceUsd: item.priceUsd,
        priceLabel: formatMoney(item.priceUsd),
        monthlyAllowanceMicros: item.monthlyAllowanceMicros,
        monthlyAllowanceLabel: formatMoney(microsToDollars(item.monthlyAllowanceMicros)),
      })),
  }
}

async function resetIncludedBalanceTx(
  tx: typeof db,
  args: {
    organizationId: string
    currentIncludedBalanceMicros: number
    idempotencyKey: string
    reason: string
    metadata?: Record<string, unknown>
  },
) {
  if (args.currentIncludedBalanceMicros <= 0) return

  const inserted = await tx
    .insertInto('billing_ledger')
    .values({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      kind: 'manual_adjustment',
      bucket: 'included',
      amountMicros: String(-args.currentIncludedBalanceMicros),
      stripeEventId: null,
      stripeInvoiceId: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      usageId: null,
      idempotencyKey: args.idempotencyKey,
      metadata: {
        reason: args.reason,
        ...(args.metadata ?? {}),
      },
      createdAt: new Date(),
    })
    .onConflict((oc) => oc.column('idempotencyKey').doNothing())
    .returning('id')
    .executeTakeFirst()

  if (!inserted) return

  await tx
    .updateTable('billing_account')
    .set({
      includedBalanceMicros: '0',
      updatedAt: new Date(),
    })
    .where('organizationId', '=', args.organizationId)
    .execute()
}

async function insertLedgerEntry(
  tx: typeof db,
  args: {
    organizationId: string
    kind: BillingLedgerKind
    bucket: BillingBucket
    amountMicros: number
    idempotencyKey: string
    stripeEventId?: string | null
    stripeInvoiceId?: string | null
    stripeCheckoutSessionId?: string | null
    stripePaymentIntentId?: string | null
    usageId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const inserted = await tx
    .insertInto('billing_ledger')
    .values({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      kind: args.kind,
      bucket: args.bucket,
      amountMicros: String(args.amountMicros),
      stripeEventId: args.stripeEventId ?? null,
      stripeInvoiceId: args.stripeInvoiceId ?? null,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: args.stripePaymentIntentId ?? null,
      usageId: args.usageId ?? null,
      idempotencyKey: args.idempotencyKey,
      metadata: args.metadata ?? {},
      createdAt: new Date(),
    })
    .onConflict((oc) => oc.column('idempotencyKey').doNothing())
    .returning('id')
    .executeTakeFirst()

  if (!inserted) return false

  if (args.bucket === 'included') {
    await tx
      .updateTable('billing_account')
      .set({
        includedBalanceMicros: sql`"includedBalanceMicros" + ${String(args.amountMicros)}`,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', args.organizationId)
      .execute()
  }

  if (args.bucket === 'prepaid') {
    await tx
      .updateTable('billing_account')
      .set({
        prepaidBalanceMicros: sql`"prepaidBalanceMicros" + ${String(args.amountMicros)}`,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', args.organizationId)
      .execute()
  }

  return true
}

async function ensureBillingStateTx(tx: typeof db, organizationId: string) {
  const org = await tx
    .selectFrom('organization')
    .select(['id', 'stripeCustomerId'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const now = new Date()

  await tx
    .insertInto('billing_account')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      stripeCustomerId: org.stripeCustomerId ?? null,
      includedBalanceMicros: '0',
      prepaidBalanceMicros: '0',
      autoReloadEnabled: false,
      monthlySpendLimitMicros: null,
      currency: 'usd',
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.column('organizationId').doUpdateSet({
        stripeCustomerId: org.stripeCustomerId ?? null,
        updatedAt: now,
      }),
    )
    .execute()

  await tx
    .insertInto('billing_subscription')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      stripeSubscriptionId: null,
      stripePriceId: null,
      tier: 'free',
      interval: null,
      status: 'free',
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: startOfMonth(now),
      currentPeriodEnd: addMonths(startOfMonth(now), 1),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      monthlyAllowanceMicros: String(freePlan.monthlyAllowanceMicros),
      nextAllowanceGrantAt: null,
      stripeCouponId: null,
      stripeDiscountId: null,
      stripePromotionCodeId: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) => oc.column('organizationId').doNothing())
    .execute()

  await tx
    .updateTable('billing_subscription')
    .set({
      monthlyAllowanceMicros: String(freePlan.monthlyAllowanceMicros),
      updatedAt: now,
    })
    .where('organizationId', '=', organizationId)
    .where('tier', '=', 'free')
    .execute()

  const account = await tx
    .selectFrom('billing_account')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()

  const subscription = await tx
    .selectFrom('billing_subscription')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()

  return { account, subscription }
}

async function applyAllowanceGrantsTx(tx: typeof db, row: BillingStateRow, now = new Date()) {
  const monthlyAllowanceMicros = asNumber(row.subscription.monthlyAllowanceMicros)
  if (!monthlyAllowanceMicros || !allowanceEligible(row.subscription)) return
  const isFreePlan = row.subscription.tier === 'free'

  let anchor = row.subscription.nextAllowanceGrantAt
  if (!anchor) {
    anchor = row.subscription.currentPeriodStart ?? startOfMonth(now)
    await resetIncludedBalanceTx(tx, {
      organizationId: row.account.organizationId,
      currentIncludedBalanceMicros: asNumber(row.account.includedBalanceMicros),
      idempotencyKey: `included-reset:${row.account.organizationId}:${anchor.toISOString()}`,
      reason: 'allowance_reset',
      metadata: { tier: row.subscription.tier },
    })
    await insertLedgerEntry(tx, {
      organizationId: row.account.organizationId,
      kind: 'subscription_allowance',
      bucket: 'included',
      amountMicros: monthlyAllowanceMicros,
      idempotencyKey: `allowance:${row.account.organizationId}:${anchor.toISOString()}`,
      metadata: { tier: row.subscription.tier, anchor: anchor.toISOString() },
    })
    await tx
      .updateTable('billing_subscription')
      .set(
        isFreePlan
          ? {
              currentPeriodStart: anchor,
              currentPeriodEnd: nextAllowanceDate(anchor),
              nextAllowanceGrantAt: nextAllowanceDate(anchor),
              updatedAt: now,
            }
          : {
              nextAllowanceGrantAt: nextAllowanceDate(anchor),
              updatedAt: now,
            },
      )
      .where('organizationId', '=', row.account.organizationId)
      .execute()
    if (isFreePlan) {
      row.subscription.currentPeriodStart = anchor
      row.subscription.currentPeriodEnd = nextAllowanceDate(anchor)
    }
    row.subscription.nextAllowanceGrantAt = nextAllowanceDate(anchor)
  }

  let nextAt = row.subscription.nextAllowanceGrantAt
  while (nextAt && nextAt <= now) {
    const account = await tx
      .selectFrom('billing_account')
      .select('includedBalanceMicros')
      .where('organizationId', '=', row.account.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()

    await resetIncludedBalanceTx(tx, {
      organizationId: row.account.organizationId,
      currentIncludedBalanceMicros: asNumber(account.includedBalanceMicros),
      idempotencyKey: `included-reset:${row.account.organizationId}:${nextAt.toISOString()}`,
      reason: 'allowance_reset',
      metadata: { tier: row.subscription.tier },
    })
    await insertLedgerEntry(tx, {
      organizationId: row.account.organizationId,
      kind: 'subscription_allowance',
      bucket: 'included',
      amountMicros: monthlyAllowanceMicros,
      idempotencyKey: `allowance:${row.account.organizationId}:${nextAt.toISOString()}`,
      metadata: { tier: row.subscription.tier, anchor: nextAt.toISOString() },
    })
    if (isFreePlan) {
      row.subscription.currentPeriodStart = nextAt
      row.subscription.currentPeriodEnd = nextAllowanceDate(nextAt)
    }
    nextAt = nextAllowanceDate(nextAt)
  }

  await tx
    .updateTable('billing_subscription')
    .set(
      isFreePlan
        ? {
            currentPeriodStart: row.subscription.currentPeriodStart,
            currentPeriodEnd: row.subscription.currentPeriodEnd,
            nextAllowanceGrantAt: nextAt,
            updatedAt: now,
          }
        : {
            nextAllowanceGrantAt: nextAt,
            updatedAt: now,
          },
    )
    .where('organizationId', '=', row.account.organizationId)
    .execute()
}

async function getBillingState(organizationId: string) {
  const state = await db.transaction().execute(async (tx) => {
    const row = await ensureBillingStateTx(tx, organizationId)
    await applyAllowanceGrantsTx(tx, row)

    const account = await tx
      .selectFrom('billing_account')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow()
    const subscription = await tx
      .selectFrom('billing_subscription')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow()

    return { account, subscription }
  })

  return state
}

export async function ensureBillingState(organizationId: string) {
  return getBillingState(organizationId)
}

async function getUsageSpentMicros(organizationId: string, periodStart: Date | null) {
  const start = periodStart ?? startOfMonth(new Date())
  const row = await db
    .selectFrom('billing_ledger')
    .select(
      sql<string>`COALESCE(SUM(CASE WHEN "kind" = 'usage_debit' THEN ABS("amountMicros") ELSE 0 END), 0)`.as(
        'spentMicros',
      ),
    )
    .where('organizationId', '=', organizationId)
    .where('createdAt', '>=', start)
    .executeTakeFirst()

  return asNumber(row?.spentMicros)
}

async function normalizeState(row: BillingStateRow) {
  const plan = getPlanConfig(row.subscription.tier, row.subscription.interval)
  const includedBalanceMicros = asNumber(row.account.includedBalanceMicros)
  const prepaidBalanceMicros = asNumber(row.account.prepaidBalanceMicros)
  const monthlyAllowanceMicros = asNumber(row.subscription.monthlyAllowanceMicros)
  const monthlySpendLimitMicros = asNumber(row.account.monthlySpendLimitMicros)
  const totalBalanceMicros = includedBalanceMicros + prepaidBalanceMicros
  const usedMicros = await getUsageSpentMicros(
    row.account.organizationId,
    getUsagePeriodStart(row.subscription),
  )
  const totalBudgetMicros = totalBalanceMicros + usedMicros
  const balancePercent = totalBudgetMicros
    ? Math.max(0, Math.min((usedMicros / totalBudgetMicros) * 100, 100))
    : 0
  return {
    organizationId: row.account.organizationId,
    stripeCustomerId: row.account.stripeCustomerId,
    tier: plan.tier,
    interval: plan.interval,
    status: row.subscription.status,
    trialEnd: row.subscription.trialEnd?.toISOString() ?? null,
    currentPeriodEnd: row.subscription.currentPeriodEnd?.toISOString() ?? null,
    nextAllowanceGrantAt: row.subscription.nextAllowanceGrantAt?.toISOString() ?? null,
    cancelAtPeriodEnd: row.subscription.cancelAtPeriodEnd,
    includedBalanceMicros,
    prepaidBalanceMicros,
    totalBalanceMicros,
    totalBudgetMicros,
    usedMicros,
    usedPercent: balancePercent,
    monthlyAllowanceMicros,
    monthlySpendLimitMicros,
    paymentMethodBrand: row.account.paymentMethodBrand,
    paymentMethodLast4: row.account.paymentMethodLast4,
    stripeCouponId: row.subscription.stripeCouponId,
    stripeDiscountId: row.subscription.stripeDiscountId,
    stripePromotionCodeId: row.subscription.stripePromotionCodeId,
    topupMinUsd: config.stripe.topup.minUsd,
    features: {
      projectsLimit: plan.projectsLimit,
      privateProjects: plan.privateProjects,
      publishYourApp: plan.publishYourApp,
      downloadCode: plan.downloadCode,
      canUseAi: totalBalanceMicros > 0,
    },
  }
}

async function getBillingBaseSnapshot(organizationId: string) {
  return normalizeState(await getBillingState(organizationId))
}

export async function getBillingSnapshot(organizationId: string): Promise<BillingSnapshot> {
  const base = await getBillingBaseSnapshot(organizationId)
  return {
    ...base,
    billingOptions: getCatalogDisplay().billingOptions,
  }
}

export async function ensureStripeCustomer(
  organizationId: string,
  args: { email?: string | null; name?: string | null },
) {
  const organization = await db
    .selectFrom('organization')
    .select('stripeCustomerId')
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  if (organization.stripeCustomerId) return organization.stripeCustomerId

  const client = requireStripe()
  const customer = await client.customers.create(
    {
      email: args.email ?? undefined,
      name: args.name ?? undefined,
      metadata: { organizationId },
    },
    {
      idempotencyKey: `billing-customer:${organizationId}`,
    },
  )
  const now = new Date()

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('organization')
      .set({ stripeCustomerId: customer.id, updatedAt: now })
      .where('id', '=', organizationId)
      .execute()

    await tx
      .updateTable('billing_account')
      .set({ stripeCustomerId: customer.id, updatedAt: now })
      .where('organizationId', '=', organizationId)
      .execute()
  })

  return customer.id
}

function rankSubscription(sub: Stripe.Subscription) {
  const statusRank: Record<string, number> = {
    active: 5,
    trialing: 4,
    past_due: 3,
    unpaid: 2,
    canceled: 1,
    incomplete: 0,
    incomplete_expired: -1,
  }

  return statusRank[sub.status] ?? 0
}

function pickSubscription(subscriptions: Stripe.Subscription[]) {
  return [...subscriptions].sort((a, b) => {
    const rank = rankSubscription(b) - rankSubscription(a)
    if (rank !== 0) return rank
    return b.created - a.created
  })[0]
}

function getDefaultPaymentMethod(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): Stripe.PaymentMethod | null {
  if (customer.deleted) return null
  const paymentMethod = customer.invoice_settings.default_payment_method
  if (!paymentMethod || typeof paymentMethod === 'string') return null
  return paymentMethod
}

function getPaymentMethodCustomerId(paymentMethod: Stripe.PaymentMethod) {
  return typeof paymentMethod.customer === 'string'
    ? paymentMethod.customer
    : (paymentMethod.customer?.id ?? null)
}

async function retrievePaymentMethodFromPaymentIntent(
  client: Stripe,
  paymentIntentId: string | null | undefined,
) {
  if (!paymentIntentId) return null

  const paymentIntent = await client.paymentIntents.retrieve(paymentIntentId, {
    expand: ['payment_method'],
  })
  const paymentMethod = paymentIntent.payment_method
  if (!paymentMethod || typeof paymentMethod === 'string') return null
  return paymentMethod
}

async function retrievePaymentMethodFromInvoice(
  client: Stripe,
  invoiceId: string | null | undefined,
) {
  if (!invoiceId) return null

  const invoice = await client.invoices.retrieve(invoiceId, {
    expand: ['payments'],
  })
  const paymentIntent = invoice.payments?.data[0]?.payment.payment_intent
  const paymentIntentId =
    typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent?.id ?? null)

  return retrievePaymentMethodFromPaymentIntent(client, paymentIntentId)
}

async function persistBillingPaymentMethod(args: {
  organizationId: string
  paymentMethod: Stripe.PaymentMethod | null
  stripeCustomerId?: string | null
}) {
  const paymentMethod = args.paymentMethod
  if (!paymentMethod) return false

  const paymentMethodCustomerId = getPaymentMethodCustomerId(paymentMethod)
  if (!paymentMethodCustomerId) return false
  if (args.stripeCustomerId && paymentMethodCustomerId !== args.stripeCustomerId) return false

  const now = new Date()

  await db
    .updateTable('billing_account')
    .set({
      defaultPaymentMethodId: paymentMethod.id,
      paymentMethodBrand:
        paymentMethod.type === 'card' ? (paymentMethod.card?.brand ?? null) : null,
      paymentMethodLast4:
        paymentMethod.type === 'card' ? (paymentMethod.card?.last4 ?? null) : null,
      updatedAt: now,
    })
    .where('organizationId', '=', args.organizationId)
    .execute()

  return true
}

function getStripeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Top-up failed'
}

function shouldFallbackToCollectedTopup(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const type = 'type' in error && typeof error.type === 'string' ? error.type : null
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null
  const declineCode =
    'decline_code' in error && typeof error.decline_code === 'string' ? error.decline_code : null
  const paymentIntent =
    'payment_intent' in error && typeof error.payment_intent === 'object'
      ? error.payment_intent
      : null
  const status =
    paymentIntent && 'status' in paymentIntent && typeof paymentIntent.status === 'string'
      ? paymentIntent.status
      : null

  if (type === 'StripeCardError') return true
  if (type === 'StripeInvalidRequestError') return true
  if (code === 'authentication_required') return true
  if (code === 'resource_missing') return true
  if (declineCode === 'authentication_required') return true
  if (status === 'requires_action' || status === 'requires_payment_method') return true

  return false
}

async function createCheckoutTopupSession(args: {
  organizationId: string
  userId: string
  amountUsd: number
  customerId: string
  requestId?: string
  returnPath?: string | null
  error?: string | null
}) {
  const client = requireStripe()
  const amountCents = Math.round(args.amountUsd * 100)
  const returnBase = resolveBillingReturnUrl(args.returnPath)
  const sep = returnBase.includes('?') ? '&' : '?'
  const successUrl = `${returnBase}${sep}billing=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${returnBase}${sep}billing=cancelled`
  const idempotencyKey = args.requestId ? `billing-topup-checkout:${args.requestId}` : undefined
  const session = await client.checkout.sessions.create(
    {
      customer: args.customerId,
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Surgent usage balance top-up',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        setup_future_usage: 'off_session',
      },
      saved_payment_method_options: {
        payment_method_save: 'enabled',
      },
      metadata: {
        organizationId: args.organizationId,
        userId: args.userId,
        amountUsd: args.amountUsd.toFixed(2),
        kind: 'topup',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  )

  if (!session.url) throw new Error('Stripe did not return a checkout URL')

  return {
    mode: 'checkout' as const,
    url: session.url,
    error: args.error ?? null,
  }
}

export async function syncStripeCustomerToBillingState(args: {
  organizationId: string
  stripeCustomerId?: string | null
  checkoutSessionId?: string | null
}) {
  const state = await getBillingState(args.organizationId)
  let kind: BillingSyncKind = null
  let customerId = args.stripeCustomerId ?? state.account.stripeCustomerId
  if (args.checkoutSessionId && stripe) {
    const session = await stripe.checkout.sessions.retrieve(args.checkoutSessionId)
    const sessionOrganizationId = session.metadata?.organizationId ?? session.client_reference_id
    if (sessionOrganizationId && sessionOrganizationId !== args.organizationId) {
      throw new Error('Checkout session does not belong to this organization')
    }
    const sessionCustomerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    customerId = sessionCustomerId ?? customerId

    if (session.mode === 'payment' && session.payment_status === 'paid') {
      kind = 'topup'
      await applyTopupCheckout({
        organizationId: args.organizationId,
        session,
      })
    }

    if (session.mode === 'subscription') {
      kind = 'subscription'
    }
  }
  if (!customerId) return kind

  const client = requireStripe()
  const customer = await client.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  const subscriptions = await client.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })
  const primary = subscriptions.data.length ? pickSubscription(subscriptions.data) : null
  const subscriptionDetails =
    primary &&
    (await client.subscriptions.retrieve(primary.id, {
      expand: [
        'default_payment_method',
        'discounts',
        'discounts.coupon',
        'discounts.promotion_code',
      ],
    }))
  const activeSubscription =
    subscriptionDetails &&
    ['active', 'trialing', 'past_due', 'unpaid'].includes(subscriptionDetails.status)
      ? subscriptionDetails
      : null
  const plan = activeSubscription
    ? getPlanFromPriceId(activeSubscription.items.data[0]?.price.id)
    : freePlan
  const discount = getDiscountIds(activeSubscription?.discounts)
  const customerPaymentMethod = getDefaultPaymentMethod(customer)
  let paymentMethod = customerPaymentMethod

  // Prefer the method that actually paid the latest successful subscription invoice.
  if (activeSubscription?.latest_invoice) {
    const invoiceId =
      typeof activeSubscription.latest_invoice === 'string'
        ? activeSubscription.latest_invoice
        : activeSubscription.latest_invoice.id
    paymentMethod = await retrievePaymentMethodFromInvoice(client, invoiceId)
  }

  if (!paymentMethod && activeSubscription?.default_payment_method) {
    const pm = activeSubscription.default_payment_method
    if (typeof pm === 'string') {
      try {
        paymentMethod = await client.paymentMethods.retrieve(pm)
      } catch {}
    } else {
      paymentMethod = pm
    }
  }

  if (!paymentMethod) paymentMethod = customerPaymentMethod

  const now = new Date()
  const nextPeriodStart = activeSubscription?.items.data[0]?.current_period_start
    ? new Date(activeSubscription.items.data[0].current_period_start * 1000)
    : startOfMonth(now)
  const shouldResetIncluded =
    state.subscription.tier !== plan.tier ||
    state.subscription.interval !== plan.interval ||
    state.subscription.stripeSubscriptionId !== (activeSubscription?.id ?? null) ||
    (state.subscription.currentPeriodStart?.toISOString() ?? null) !== nextPeriodStart.toISOString()

  await db.transaction().execute(async (tx) => {
    await ensureBillingStateTx(tx, args.organizationId)

    await tx
      .updateTable('organization')
      .set({ stripeCustomerId: customerId, updatedAt: now })
      .where('id', '=', args.organizationId)
      .execute()

    await tx
      .updateTable('billing_account')
      .set({
        stripeCustomerId: customerId,
        defaultPaymentMethodId: paymentMethod?.id ?? null,
        paymentMethodBrand:
          paymentMethod?.type === 'card' ? (paymentMethod.card?.brand ?? null) : null,
        paymentMethodLast4:
          paymentMethod?.type === 'card' ? (paymentMethod.card?.last4 ?? null) : null,
        updatedAt: now,
      })
      .where('organizationId', '=', args.organizationId)
      .execute()

    await tx
      .updateTable('billing_subscription')
      .set({
        stripeSubscriptionId: activeSubscription?.id ?? null,
        stripePriceId: activeSubscription?.items.data[0]?.price.id ?? null,
        tier: plan.tier,
        interval: plan.interval,
        status: activeSubscription?.status ?? 'free',
        trialStart: activeSubscription?.trial_start
          ? new Date(activeSubscription.trial_start * 1000)
          : null,
        trialEnd: activeSubscription?.trial_end
          ? new Date(activeSubscription.trial_end * 1000)
          : null,
        currentPeriodStart: nextPeriodStart,
        currentPeriodEnd: activeSubscription?.items.data[0]?.current_period_end
          ? new Date(activeSubscription.items.data[0].current_period_end * 1000)
          : addMonths(startOfMonth(now), 1),
        cancelAtPeriodEnd: activeSubscription?.cancel_at_period_end ?? false,
        canceledAt: activeSubscription?.canceled_at
          ? new Date(activeSubscription.canceled_at * 1000)
          : null,
        monthlyAllowanceMicros: String(plan.monthlyAllowanceMicros),
        nextAllowanceGrantAt: shouldResetIncluded ? null : state.subscription.nextAllowanceGrantAt,
        stripeCouponId: discount.stripeCouponId,
        stripeDiscountId: discount.stripeDiscountId,
        stripePromotionCodeId: discount.stripePromotionCodeId,
        updatedAt: now,
      })
      .where('organizationId', '=', args.organizationId)
      .execute()

    const row = await ensureBillingStateTx(tx, args.organizationId)
    if (shouldResetIncluded) {
      await resetIncludedBalanceTx(tx, {
        organizationId: args.organizationId,
        currentIncludedBalanceMicros: asNumber(row.account.includedBalanceMicros),
        idempotencyKey: `included-reset:${args.organizationId}:${nextPeriodStart.toISOString()}`,
        reason: 'subscription_sync_reset',
        metadata: { tier: plan.tier, interval: plan.interval },
      })
      row.account.includedBalanceMicros = '0'
      row.subscription.nextAllowanceGrantAt = null
    }
    await applyAllowanceGrantsTx(tx, row, now)
  })

  return kind
}

export async function findOrganizationIdByStripeCustomerId(stripeCustomerId: string) {
  const row = await db
    .selectFrom('organization')
    .select('id')
    .where('stripeCustomerId', '=', stripeCustomerId)
    .executeTakeFirst()

  return row?.id ?? null
}

export async function createBillingCheckout(args: {
  organizationId: string
  userId: string
  email?: string | null
  name?: string | null
  interval: Exclude<BillingInterval, null>
  requestId?: string
  returnPath?: string | null
}) {
  const plan = getPlanConfig('pro', args.interval)
  if (!plan.priceId) throw new Error(`${plan.label} is not configured`)
  const snapshot = await getBillingBaseSnapshot(args.organizationId)
  if (
    snapshot.tier !== 'free' &&
    ['active', 'trialing', 'past_due', 'unpaid'].includes(snapshot.status)
  ) {
    throw new Error('Manage your existing subscription from billing settings')
  }

  const customer = await ensureStripeCustomer(args.organizationId, {
    email: args.email,
    name: args.name,
  })

  const client = requireStripe()
  const returnBase = resolveBillingReturnUrl(args.returnPath)
  const sep = returnBase.includes('?') ? '&' : '?'
  const successUrl = `${returnBase}${sep}billing=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${returnBase}${sep}billing=cancelled`

  const session = await client.checkout.sessions.create(
    {
      customer,
      client_reference_id: args.organizationId,
      mode: 'subscription',
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          organizationId: args.organizationId,
          userId: args.userId,
          tier: 'pro',
          interval: args.interval,
        },
      },
      metadata: {
        organizationId: args.organizationId,
        userId: args.userId,
        tier: 'pro',
        interval: args.interval,
        kind: 'subscription',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
    args.requestId ? { idempotencyKey: `billing-checkout:${args.requestId}` } : undefined,
  )

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return session.url
}

export async function createTopupPaymentIntent(args: {
  organizationId: string
  userId: string
  email?: string | null
  name?: string | null
  amountUsd: number
  requestId?: string
  returnPath?: string | null
}): Promise<TopupPaymentIntentResult> {
  const snapshot = await getBillingBaseSnapshot(args.organizationId)
  if (snapshot.tier === 'free') throw new Error('Upgrade to a paid plan before buying balance')

  const amountUsd = Math.round(args.amountUsd * 100) / 100
  if (!Number.isFinite(amountUsd) || amountUsd < config.stripe.topup.minUsd) {
    throw new Error(`Top-up amount must be at least $${config.stripe.topup.minUsd}`)
  }

  const customerId =
    snapshot.stripeCustomerId ??
    (await ensureStripeCustomer(args.organizationId, {
      email: args.email,
      name: args.name,
    }))
  const state = await getBillingState(args.organizationId)
  const paymentMethodId = state.account.defaultPaymentMethodId
  const client = requireStripe()

  if (paymentMethodId) {
    try {
      const idempotencyKey = args.requestId ? `billing-topup-charge:${args.requestId}` : undefined
      const paymentIntent = await client.paymentIntents.create(
        {
          amount: Math.round(amountUsd * 100),
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          payment_method_types: ['card'],
          confirm: true,
          off_session: true,
          error_on_requires_action: true,
          description: 'Surgent usage balance top-up',
          metadata: {
            organizationId: args.organizationId,
            userId: args.userId,
            amountUsd: amountUsd.toFixed(2),
            kind: 'topup',
          },
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      )

      if (paymentIntent.status === 'succeeded') {
        await applyTopupPaymentIntent({
          organizationId: args.organizationId,
          paymentIntentId: paymentIntent.id,
        })
        await syncStripeCustomerToBillingState({
          organizationId: args.organizationId,
          stripeCustomerId: customerId,
        })
        return {
          mode: 'charged',
          snapshot: await getBillingSnapshot(args.organizationId),
        }
      }
    } catch (error) {
      if (!shouldFallbackToCollectedTopup(error)) throw error
      return createCheckoutTopupSession({
        organizationId: args.organizationId,
        userId: args.userId,
        amountUsd,
        customerId,
        requestId: args.requestId,
        returnPath: args.returnPath,
        error: getStripeErrorMessage(error),
      })
    }
  }

  return createCheckoutTopupSession({
    organizationId: args.organizationId,
    userId: args.userId,
    amountUsd,
    customerId,
    requestId: args.requestId,
    returnPath: args.returnPath,
  })
}

export async function applyTopupPaymentIntent(args: {
  organizationId: string
  paymentIntentId: string
  stripeEventId?: string | null
}) {
  const client = requireStripe()
  const paymentIntent = await client.paymentIntents.retrieve(args.paymentIntentId, {
    expand: ['payment_method'],
  })
  if (paymentIntent.status !== 'succeeded') return false

  const customerId =
    typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id
  const organizationId =
    paymentIntent.metadata?.organizationId ??
    (customerId ? await findOrganizationIdByStripeCustomerId(customerId) : null)
  if (organizationId && organizationId !== args.organizationId) {
    throw new Error('Payment intent does not belong to this organization')
  }

  const amountMicros = centsToMicros(paymentIntent.amount_received || paymentIntent.amount)
  const now = new Date()

  await db.transaction().execute(async (tx) => {
    await ensureBillingStateTx(tx, args.organizationId)
    await insertLedgerEntry(tx, {
      organizationId: args.organizationId,
      kind: 'topup_purchase',
      bucket: 'prepaid',
      amountMicros,
      stripeEventId: args.stripeEventId ?? null,
      stripePaymentIntentId: paymentIntent.id,
      idempotencyKey: `topup:${paymentIntent.id}`,
      metadata: { amountUsd: paymentIntent.metadata?.amountUsd ?? null },
    })

    await tx
      .insertInto('billing_payment')
      .values({
        id: crypto.randomUUID(),
        organizationId: args.organizationId,
        kind: 'topup',
        stripeInvoiceId: null,
        stripePaymentIntentId: paymentIntent.id,
        stripeCheckoutSessionId: null,
        stripeCouponId: null,
        stripeDiscountId: null,
        stripePromotionCodeId: null,
        amountMicros: String(amountMicros),
        refundedAmountMicros: '0',
        refundedAt: null,
        currency: paymentIntent.currency ?? 'usd',
        status: 'paid',
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((oc) => oc.column('stripePaymentIntentId').doNothing())
      .execute()
  })

  const paymentMethod = paymentIntent.payment_method
  if (paymentMethod && typeof paymentMethod !== 'string') {
    await persistBillingPaymentMethod({
      organizationId: args.organizationId,
      paymentMethod,
      stripeCustomerId: customerId,
    })
  }

  return true
}

export async function createBillingPortal(args: {
  organizationId: string
  returnPath?: string | null
}) {
  const snapshot = await getBillingBaseSnapshot(args.organizationId)
  if (!snapshot.stripeCustomerId) throw new Error('No Stripe customer found for this organization')

  const client = requireStripe()
  const returnUrl = new URL(resolveBillingReturnUrl(args.returnPath))
  returnUrl.searchParams.set('billing', 'return')
  const session = await client.billingPortal.sessions.create({
    customer: snapshot.stripeCustomerId,
    return_url: returnUrl.toString(),
  })

  return session.url
}

export async function applyTopupCheckout(args: {
  organizationId: string
  session: Stripe.Checkout.Session
  stripeEventId?: string | null
}) {
  const paymentIntentId =
    typeof args.session.payment_intent === 'string'
      ? args.session.payment_intent
      : args.session.payment_intent?.id
  const amountMicros = args.session.amount_total
    ? centsToMicros(args.session.amount_total)
    : dollarsToMicros(Number(args.session.metadata?.amountUsd ?? 0))

  await db.transaction().execute(async (tx) => {
    await ensureBillingStateTx(tx, args.organizationId)
    await insertLedgerEntry(tx, {
      organizationId: args.organizationId,
      kind: 'topup_purchase',
      bucket: 'prepaid',
      amountMicros,
      stripeEventId: args.stripeEventId ?? null,
      stripeInvoiceId:
        typeof args.session.invoice === 'string' ? args.session.invoice : args.session.invoice?.id,
      stripeCheckoutSessionId: args.session.id,
      stripePaymentIntentId: paymentIntentId ?? null,
      idempotencyKey: `topup:${args.session.id}`,
      metadata: { amountUsd: args.session.metadata?.amountUsd ?? null },
    })

    await tx
      .insertInto('billing_payment')
      .values({
        id: crypto.randomUUID(),
        organizationId: args.organizationId,
        kind: 'topup',
        stripeInvoiceId:
          typeof args.session.invoice === 'string'
            ? args.session.invoice
            : args.session.invoice?.id,
        stripePaymentIntentId: paymentIntentId ?? null,
        stripeCheckoutSessionId: args.session.id,
        stripeCouponId: null,
        stripeDiscountId: null,
        stripePromotionCodeId: null,
        amountMicros: String(amountMicros),
        refundedAmountMicros: '0',
        refundedAt: null,
        currency: 'usd',
        status: args.session.payment_status,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflict((oc) => oc.column('stripeCheckoutSessionId').doNothing())
      .execute()
  })

  const customerId =
    typeof args.session.customer === 'string' ? args.session.customer : args.session.customer?.id
  const paymentMethod = await retrievePaymentMethodFromPaymentIntent(
    requireStripe(),
    paymentIntentId,
  )
  await persistBillingPaymentMethod({
    organizationId: args.organizationId,
    paymentMethod,
    stripeCustomerId: customerId,
  })
}

export async function syncBillingPaymentFromInvoice(args: {
  organizationId: string
  invoiceId: string
  status: string
}) {
  const client = requireStripe()
  const invoice = await client.invoices.retrieve(args.invoiceId, {
    expand: ['discounts', 'discounts.coupon', 'discounts.promotion_code', 'payments'],
  })
  const subscriptionId = invoice.parent?.subscription_details?.subscription
  if (!subscriptionId) return

  const paymentIntent = invoice.payments?.data[0]?.payment.payment_intent
  const paymentIntentId =
    typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent?.id ?? null)
  const amountMicros = centsToMicros(
    args.status === 'paid' ? invoice.amount_paid : invoice.amount_due,
  )
  const discount = getDiscountIds(invoice.discounts)

  await db
    .insertInto('billing_payment')
    .values({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      kind: 'subscription',
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: null,
      stripeCouponId: discount.stripeCouponId,
      stripeDiscountId: discount.stripeDiscountId,
      stripePromotionCodeId: discount.stripePromotionCodeId,
      amountMicros: String(amountMicros),
      refundedAmountMicros: '0',
      refundedAt: null,
      currency: invoice.currency ?? 'usd',
      status: args.status,
      createdAt: new Date(invoice.created * 1000),
      updatedAt: new Date(),
    })
    .onConflict((oc) =>
      oc.column('stripeInvoiceId').doUpdateSet({
        stripePaymentIntentId: paymentIntentId,
        stripeCouponId: discount.stripeCouponId,
        stripeDiscountId: discount.stripeDiscountId,
        stripePromotionCodeId: discount.stripePromotionCodeId,
        amountMicros: String(amountMicros),
        currency: invoice.currency ?? 'usd',
        status: args.status,
        updatedAt: new Date(),
      }),
    )
    .execute()

  const paymentMethod = await retrievePaymentMethodFromPaymentIntent(client, paymentIntentId)
  await persistBillingPaymentMethod({
    organizationId: args.organizationId,
    paymentMethod,
    stripeCustomerId:
      typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null),
  })
}

export async function refundBillingPayment(args: {
  organizationId: string
  stripePaymentIntentId: string
  refundedAmountMicros: number
  refundedAt: Date
  stripeEventId?: string | null
}) {
  const payment = await db
    .selectFrom('billing_payment')
    .selectAll()
    .where('organizationId', '=', args.organizationId)
    .where('stripePaymentIntentId', '=', args.stripePaymentIntentId)
    .orderBy('createdAt', 'desc')
    .executeTakeFirst()

  if (!payment) return

  const previousRefundedMicros = asNumber(payment.refundedAmountMicros)
  const deltaMicros = Math.max(args.refundedAmountMicros - previousRefundedMicros, 0)
  if (!deltaMicros) return

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('billing_payment')
      .set({
        refundedAmountMicros: String(args.refundedAmountMicros),
        refundedAt: args.refundedAt,
        status:
          args.refundedAmountMicros >= asNumber(payment.amountMicros)
            ? 'refunded'
            : 'partially_refunded',
        updatedAt: new Date(),
      })
      .where('id', '=', payment.id)
      .execute()

    if (payment.kind !== 'topup' && payment.kind !== 'auto_reload') return

    await insertLedgerEntry(tx, {
      organizationId: args.organizationId,
      kind: 'refund',
      bucket: 'prepaid',
      amountMicros: -deltaMicros,
      stripeEventId: args.stripeEventId ?? null,
      stripeInvoiceId: payment.stripeInvoiceId,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      idempotencyKey: `refund:${payment.id}:${args.refundedAmountMicros}`,
      metadata: { paymentId: payment.id, kind: payment.kind },
    })
  })
}

export async function checkBillingFeature(args: {
  organizationId: string
  featureId: BillingFeatureId
  currentProjects?: number
}) {
  const snapshot = await getBillingBaseSnapshot(args.organizationId)

  if (args.featureId === 'projects') {
    const limit = snapshot.features.projectsLimit
    return {
      allowed: limit === null || (args.currentProjects ?? 0) < limit,
      balance: limit,
      unlimited: limit === null,
    }
  }

  if (args.featureId === 'private_projects') {
    return { allowed: snapshot.features.privateProjects }
  }

  if (args.featureId === 'publish_your_app') {
    return { allowed: snapshot.features.publishYourApp }
  }

  if (args.featureId === 'download_code') {
    return { allowed: snapshot.features.downloadCode }
  }

  return {
    allowed: snapshot.features.canUseAi,
    balance: snapshot.totalBalanceMicros,
    total: snapshot.totalBudgetMicros,
    nextResetAt: snapshot.nextAllowanceGrantAt,
  }
}

export async function listBillingStateForUsage(organizationId: string) {
  const row = await getBillingState(organizationId)
  return {
    organizationId,
    includedBalanceMicros: asNumber(row.account.includedBalanceMicros),
    prepaidBalanceMicros: asNumber(row.account.prepaidBalanceMicros),
    monthlySpendLimitMicros: asNumber(row.account.monthlySpendLimitMicros),
    monthlyAllowanceMicros: asNumber(row.subscription.monthlyAllowanceMicros),
    currentPeriodStart: row.subscription.currentPeriodStart,
    nextAllowanceGrantAt: row.subscription.nextAllowanceGrantAt,
    tier: row.subscription.tier,
    status: row.subscription.status,
    autoReloadEnabled: row.account.autoReloadEnabled,
  }
}

export async function grantCredits(args: {
  organizationId: string
  amountUsd: number
  reason: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}) {
  const amountMicros = dollarsToMicros(args.amountUsd)
  if (amountMicros <= 0) throw new Error('Grant amount must be positive')

  await db.transaction().execute(async (tx) => {
    await ensureBillingStateTx(tx, args.organizationId)
    await insertLedgerEntry(tx, {
      organizationId: args.organizationId,
      kind: 'reward',
      bucket: 'prepaid',
      amountMicros,
      idempotencyKey: args.idempotencyKey,
      metadata: {
        reason: args.reason,
        ...(args.metadata ?? {}),
      },
    })
  })
}
