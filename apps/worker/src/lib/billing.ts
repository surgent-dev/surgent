import type Stripe from 'stripe'
import { sql } from 'kysely'
import { getAllowanceWindow, sameAllowanceWindowStart } from '@repo/db'
import { db } from './db'
import { config } from './config'
import { trackDubSale } from './dub'
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

type BillingPaymentKind = 'topup' | 'subscription' | 'reward'

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
  nextResetAt: string | null
  cancelAtPeriodEnd: boolean
  includedRemainingMicros: number
  prepaidBalanceMicros: number
  totalBalanceMicros: number
  totalBudgetMicros: number
  usedMicros: number
  byokProviderCostMicros: number
  usedPercent: number
  monthlyAllowanceMicros: number
  monthlySpendLimitMicros: number
  paymentMethodBrand: string | null
  paymentMethodLast4: string | null
  stripeCouponId: string | null
  stripeDiscountId: string | null
  stripePromotionCodeId: string | null
  hasMigrationCredit: boolean
  founderCouponCode: string | null
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
    includedBalancePeriodStart: Date | null
    prepaidBalanceMicros: string | number
    monthlySpendLimitMicros: string | number | null
    monthlySpendUsageMicros: string | number
    monthlySpendUsagePeriodStart: Date | null
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

/** Stripe needs literal `{CHECKOUT_SESSION_ID}` — URL.searchParams would encode the braces. */
function billingReturnUrl(returnPath?: string | null, billing?: 'success' | 'return') {
  const url = new URL(resolveBillingReturnUrl(returnPath))
  if (billing) url.searchParams.set('billing', billing)
  return url.toString()
}

function billingSuccessUrl(returnPath?: string | null) {
  const url = new URL(billingReturnUrl(returnPath, 'success'))
  const hash = url.hash
  url.hash = ''
  const base = url.toString()
  return `${base}${base.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}${hash}`
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
    privateProjects: true,
    publishYourApp: true,
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

const PAID_MONTHLY_SPEND_LIMIT_MICROS = dollarsToMicros(5000)

function requireStripe() {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe
}

const FOUNDER_COUPON_ID = 'founder_50_off'

function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SRGNT-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** Read-only: returns founder coupon from DB metadata if already generated */
async function getFounderCouponData(organizationId: string) {
  const grant = await db
    .selectFrom('billing_payment')
    .select(['id', 'metadata'])
    .where('organizationId', '=', organizationId)
    .where('idempotencyKey', 'like', 'old-stripe-grant:%')
    .limit(1)
    .executeTakeFirst()

  if (!grant) return { hasMigrationCredit: false, founderCouponCode: null as string | null }

  const metadata = (grant.metadata ?? {}) as Record<string, unknown>
  return {
    hasMigrationCredit: true,
    founderCouponCode: (metadata.founderCouponCode as string) ?? null,
  }
}

/** Creates a unique Stripe promotion code for a founding member. Only call on user action. */
export async function generateFounderCoupon(
  organizationId: string,
): Promise<{ code: string; promotionCodeId: string }> {
  return db.transaction().execute(async (tx) => {
    // Lock the grant row to prevent concurrent promo code creation
    const grant = await tx
      .selectFrom('billing_payment')
      .select(['id', 'metadata'])
      .where('organizationId', '=', organizationId)
      .where('idempotencyKey', 'like', 'old-stripe-grant:%')
      .forUpdate()
      .limit(1)
      .executeTakeFirst()

    if (!grant) throw new Error('No migration credit found')

    const metadata = (grant.metadata ?? {}) as Record<string, unknown>
    if (metadata.founderCouponCode && metadata.founderPromotionCodeId) {
      return {
        code: metadata.founderCouponCode as string,
        promotionCodeId: metadata.founderPromotionCodeId as string,
      }
    }

    const client = requireStripe()

    // Get or create the shared coupon — only catch 404, re-throw everything else
    let coupon: import('stripe').Stripe.Coupon
    try {
      coupon = await client.coupons.retrieve(FOUNDER_COUPON_ID)
    } catch (err: unknown) {
      const stripeErr = err as { statusCode?: number }
      if (stripeErr.statusCode !== 404) throw err
      coupon = await client.coupons.create({
        id: FOUNDER_COUPON_ID,
        percent_off: 50,
        duration: 'once',
        name: 'Founding Member - 50% Off',
      })
    }

    const account = await tx
      .selectFrom('billing_account')
      .select('stripeCustomerId')
      .where('organizationId', '=', organizationId)
      .executeTakeFirst()

    const code = generateCouponCode()

    const promoCode = await client.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code,
      max_redemptions: 1,
      ...(account?.stripeCustomerId ? { customer: account.stripeCustomerId } : {}),
    })

    await tx
      .updateTable('billing_payment')
      .set({
        metadata: sql`coalesce(metadata, '{}'::jsonb) || ${JSON.stringify({
          founderCouponCode: promoCode.code,
          founderPromotionCodeId: promoCode.id,
        })}::jsonb`,
      })
      .where('id', '=', grant.id)
      .execute()

    return { code: promoCode.code, promotionCodeId: promoCode.id }
  })
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

function getEffectiveIncludedBalance(row: BillingStateRow, now = new Date()) {
  if (!allowanceEligible(row.subscription)) return 0

  const window = getAllowanceWindow(
    {
      tier: row.subscription.tier,
      interval: row.subscription.interval,
      currentPeriodStart: row.subscription.currentPeriodStart,
      currentPeriodEnd: row.subscription.currentPeriodEnd,
    },
    now,
  )

  if (!sameAllowanceWindowStart(row.account.includedBalancePeriodStart, window.start)) {
    return asNumber(row.subscription.monthlyAllowanceMicros)
  }

  return Math.max(asNumber(row.account.includedBalanceMicros), 0)
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

async function insertBillingPaymentEntry(
  tx: typeof db,
  args: {
    organizationId: string
    kind: BillingPaymentKind
    amountMicros: number
    status: string
    conflictColumn: 'idempotencyKey' | 'stripePaymentIntentId' | 'stripeCheckoutSessionId'
    idempotencyKey?: string | null
    stripeInvoiceId?: string | null
    stripeCheckoutSessionId?: string | null
    stripePaymentIntentId?: string | null
    stripeCouponId?: string | null
    stripeDiscountId?: string | null
    stripePromotionCodeId?: string | null
    currency?: string | null
    metadata?: Record<string, unknown>
    createdAt?: Date
    updatedAt?: Date
  },
) {
  const inserted = await tx
    .insertInto('billing_payment')
    .values({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      kind: args.kind,
      amountMicros: String(args.amountMicros),
      stripeInvoiceId: args.stripeInvoiceId ?? null,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: args.stripePaymentIntentId ?? null,
      stripeCouponId: args.stripeCouponId ?? null,
      stripeDiscountId: args.stripeDiscountId ?? null,
      stripePromotionCodeId: args.stripePromotionCodeId ?? null,
      refundedAmountMicros: '0',
      refundedAt: null,
      currency: args.currency ?? 'usd',
      status: args.status,
      idempotencyKey: args.idempotencyKey ?? null,
      metadata: args.metadata ?? {},
      createdAt: args.createdAt ?? new Date(),
      updatedAt: args.updatedAt ?? new Date(),
    })
    .onConflict((oc) => oc.column(args.conflictColumn).doNothing())
    .returning('id')
    .executeTakeFirst()

  return Boolean(inserted)
}

async function applyPrepaidBalanceDeltaTx(
  tx: typeof db,
  organizationId: string,
  amountMicros: number,
  updatedAt = new Date(),
) {
  if (!amountMicros) return
  await tx
    .updateTable('billing_account')
    .set({
      prepaidBalanceMicros: sql`GREATEST(0, "prepaidBalanceMicros" + ${String(amountMicros)})`,
      updatedAt,
    })
    .where('organizationId', '=', organizationId)
    .execute()
}

async function ensureBillingStateTx(tx: typeof db, organizationId: string) {
  await tx
    .selectFrom('organization')
    .select('id')
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const now = new Date()

  await tx
    .insertInto('billing_account')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      stripeCustomerId: null,
      includedBalanceMicros: String(freePlan.monthlyAllowanceMicros),
      includedBalancePeriodStart: startOfMonth(now),
      prepaidBalanceMicros: '0',
      autoReloadEnabled: false,
      monthlySpendLimitMicros: null,
      monthlySpendUsageMicros: '0',
      monthlySpendUsagePeriodStart: null,
      currency: 'usd',
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.column('organizationId').doUpdateSet({
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

async function getBillingState(organizationId: string) {
  return db.transaction().execute(async (tx) => ensureBillingStateTx(tx, organizationId))
}

export async function ensureBillingState(organizationId: string) {
  return getBillingState(organizationId)
}

function getMonthlySpendUsage(
  row: {
    monthlySpendUsageMicros: string | number | null
    monthlySpendUsagePeriodStart: Date | null
  },
  periodStart: Date,
) {
  if (!sameAllowanceWindowStart(row.monthlySpendUsagePeriodStart, periodStart)) return 0
  return asNumber(row.monthlySpendUsageMicros)
}

async function getUsageSpentMicrosTx(tx: typeof db, organizationId: string, periodStart: Date) {
  const row = await tx
    .selectFrom('usage')
    .innerJoin('project', 'project.id', 'usage.projectId')
    .select(sql<string>`COALESCE(SUM("usage"."billedCostMicros"), 0)`.as('spentMicros'))
    .where('project.organizationId', '=', organizationId)
    .where('usage.deletedAt', 'is', null)
    .where('usage.createdAt', '>=', periodStart)
    .executeTakeFirst()

  return asNumber(row?.spentMicros)
}

async function getByokProviderCostMicrosTx(
  tx: typeof db,
  organizationId: string,
  periodStart: Date,
) {
  const row = await tx
    .selectFrom('usage')
    .innerJoin('project', 'project.id', 'usage.projectId')
    .select(sql<string>`COALESCE(SUM("usage"."providerCostMicros"), 0)`.as('spentMicros'))
    .where('project.organizationId', '=', organizationId)
    .where('usage.deletedAt', 'is', null)
    .where('usage.billingMode', '=', 'byok')
    .where('usage.createdAt', '>=', periodStart)
    .executeTakeFirst()

  return asNumber(row?.spentMicros)
}

async function normalizeState(row: BillingStateRow, now = new Date()) {
  const plan = getPlanConfig(row.subscription.tier, row.subscription.interval)
  const allowanceWindow = getAllowanceWindow(
    {
      tier: row.subscription.tier,
      interval: row.subscription.interval,
      currentPeriodStart: row.subscription.currentPeriodStart,
      currentPeriodEnd: row.subscription.currentPeriodEnd,
    },
    now,
  )
  const includedRemainingMicros = getEffectiveIncludedBalance(row, now)
  const prepaidBalanceMicros = asNumber(row.account.prepaidBalanceMicros)
  const monthlyAllowanceMicros = asNumber(row.subscription.monthlyAllowanceMicros)
  const monthlySpendLimitMicros = asNumber(row.account.monthlySpendLimitMicros)
  const totalBalanceMicros = includedRemainingMicros + prepaidBalanceMicros
  const usedMicros = getMonthlySpendUsage(row.account, allowanceWindow.start)
  const aiBlockedByMonthlyLimit =
    monthlySpendLimitMicros > 0 && usedMicros >= monthlySpendLimitMicros
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
    nextResetAt: allowanceWindow.end.toISOString(),
    cancelAtPeriodEnd: row.subscription.cancelAtPeriodEnd,
    includedRemainingMicros,
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
      canUseAi: totalBalanceMicros > 0 && !aiBlockedByMonthlyLimit,
    },
  }
}

async function getBillingBaseSnapshot(organizationId: string) {
  const now = new Date()
  const state = await getBillingState(organizationId)
  const base = await normalizeState(state, now)
  const founder = await getFounderCouponData(organizationId)
  const allowanceWindow = getAllowanceWindow(
    {
      tier: state.subscription.tier,
      interval: state.subscription.interval,
      currentPeriodStart: state.subscription.currentPeriodStart,
      currentPeriodEnd: state.subscription.currentPeriodEnd,
    },
    now,
  )
  const byokProviderCostMicros = await getByokProviderCostMicrosTx(
    db,
    organizationId,
    allowanceWindow.start,
  )

  return {
    ...base,
    byokProviderCostMicros,
    hasMigrationCredit: founder.hasMigrationCredit,
    founderCouponCode: founder.founderCouponCode,
  }
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
  const account = await db
    .selectFrom('billing_account')
    .select('stripeCustomerId')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()

  if (account.stripeCustomerId) return account.stripeCustomerId

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

  await db
    .updateTable('billing_account')
    .set({ stripeCustomerId: customer.id, updatedAt: now })
    .where('organizationId', '=', organizationId)
    .execute()

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

  const brand =
    paymentMethod.type === 'card' ? (paymentMethod.card?.brand ?? null) : paymentMethod.type // 'link', etc.
  const last4 = paymentMethod.type === 'card' ? (paymentMethod.card?.last4 ?? null) : null

  await db
    .updateTable('billing_account')
    .set({
      defaultPaymentMethodId: paymentMethod.id,
      paymentMethodBrand: brand,
      paymentMethodLast4: last4,
      updatedAt: now,
    })
    .where('organizationId', '=', args.organizationId)
    .execute()

  return true
}

/**
 * Syncs the default payment method from a Stripe customer.updated event.
 * Only call this when invoice_settings.default_payment_method actually changed
 * (check previous_attributes in the webhook payload first).
 */
export async function syncBillingPaymentMethodFromCustomer(args: {
  stripeCustomerId: string
  paymentMethodId: string | null
}) {
  const organizationId = await findOrganizationIdByStripeCustomerId(args.stripeCustomerId)
  if (!organizationId) return

  if (!args.paymentMethodId) {
    await db
      .updateTable('billing_account')
      .set({
        defaultPaymentMethodId: null,
        paymentMethodBrand: null,
        paymentMethodLast4: null,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', organizationId)
      .execute()
    return
  }

  const client = requireStripe()
  const paymentMethod = await client.paymentMethods.retrieve(args.paymentMethodId)
  await persistBillingPaymentMethod({
    organizationId,
    paymentMethod,
    stripeCustomerId: args.stripeCustomerId,
  })
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
  const successUrl = billingSuccessUrl(args.returnPath)
  const cancelUrl = resolveBillingReturnUrl(args.returnPath)
  const idempotencyKey = args.requestId ? `billing-topup-checkout:${args.requestId}` : undefined
  const session = await client.checkout.sessions.create(
    {
      customer: args.customerId,
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      mode: 'payment',
      payment_method_types: ['card', 'link'],
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
        dubCustomerExternalId: args.userId,
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
  const subscriptions = await client.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })
  const primary = subscriptions.data.length ? pickSubscription(subscriptions.data) : null
  const subscriptionDetails =
    primary &&
    (await client.subscriptions.retrieve(primary.id, {
      expand: ['discounts', 'discounts.coupon', 'discounts.promotion_code'],
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

  // PM is managed exclusively by persistBillingPaymentMethod (called after
  // each successful payment) and syncBillingPaymentMethodFromCustomer (called
  // on customer.updated when the user changes their default PM in the Stripe
  // portal). This function never touches PM fields — doing so would overwrite
  // the card PM saved by a topup with the subscription's PM (often Stripe
  // Link), breaking off-session top-ups.

  const now = new Date()
  const nextPeriodStart = activeSubscription?.items.data[0]?.current_period_start
    ? new Date(activeSubscription.items.data[0].current_period_start * 1000)
    : startOfMonth(now)
  const currentPeriodEnd = activeSubscription?.items.data[0]?.current_period_end
    ? new Date(activeSubscription.items.data[0].current_period_end * 1000)
    : addMonths(startOfMonth(now), 1)

  await db.transaction().execute(async (tx) => {
    const state = await ensureBillingStateTx(tx, args.organizationId)
    const allowanceWindow = getAllowanceWindow(
      {
        tier: plan.tier,
        interval: plan.interval,
        currentPeriodStart: nextPeriodStart,
        currentPeriodEnd,
      },
      now,
    )
    const monthlySpendUsageMicros = sameAllowanceWindowStart(
      state.account.monthlySpendUsagePeriodStart,
      allowanceWindow.start,
    )
      ? asNumber(state.account.monthlySpendUsageMicros)
      : await getUsageSpentMicrosTx(tx, args.organizationId, allowanceWindow.start)
    const monthlySpendUsagePeriodStart = monthlySpendUsageMicros > 0 ? allowanceWindow.start : null
    const includedBalanceMicros = sameAllowanceWindowStart(
      state.account.includedBalancePeriodStart,
      allowanceWindow.start,
    )
      ? asNumber(state.account.includedBalanceMicros)
      : plan.monthlyAllowanceMicros

    await tx
      .updateTable('billing_account')
      .set({
        stripeCustomerId: customerId,
        includedBalanceMicros: String(includedBalanceMicros),
        includedBalancePeriodStart: allowanceWindow.start,
        monthlySpendLimitMicros:
          plan.tier === 'pro' ? String(PAID_MONTHLY_SPEND_LIMIT_MICROS) : null,
        monthlySpendUsageMicros: String(monthlySpendUsageMicros),
        monthlySpendUsagePeriodStart,
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
        currentPeriodEnd,
        cancelAtPeriodEnd: activeSubscription?.cancel_at_period_end ?? false,
        canceledAt: activeSubscription?.canceled_at
          ? new Date(activeSubscription.canceled_at * 1000)
          : null,
        monthlyAllowanceMicros: String(plan.monthlyAllowanceMicros),
        stripeCouponId: discount.stripeCouponId,
        stripeDiscountId: discount.stripeDiscountId,
        stripePromotionCodeId: discount.stripePromotionCodeId,
        updatedAt: now,
      })
      .where('organizationId', '=', args.organizationId)
      .execute()
  })

  return kind
}

export async function findOrganizationIdByStripeCustomerId(stripeCustomerId: string) {
  const row = await db
    .selectFrom('billing_account')
    .select('organizationId')
    .where('stripeCustomerId', '=', stripeCustomerId)
    .executeTakeFirst()

  return row?.organizationId ?? null
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
  const successUrl = billingSuccessUrl(args.returnPath)
  const cancelUrl = resolveBillingReturnUrl(args.returnPath)

  // Auto-apply founder coupon if user already generated one
  const founderGrant = await db
    .selectFrom('billing_payment')
    .select('metadata')
    .where('organizationId', '=', args.organizationId)
    .where('idempotencyKey', 'like', 'old-stripe-grant:%')
    .limit(1)
    .executeTakeFirst()
  const founderPromoId = (founderGrant?.metadata as Record<string, unknown>)
    ?.founderPromotionCodeId as string | undefined
  const discountConfig = founderPromoId
    ? { discounts: [{ promotion_code: founderPromoId }] }
    : { allow_promotion_codes: true as const }

  const session = await client.checkout.sessions.create(
    {
      customer,
      client_reference_id: args.organizationId,
      mode: 'subscription',
      payment_method_types: ['card', 'link'],
      ...discountConfig,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          dubCustomerExternalId: args.userId,
          organizationId: args.organizationId,
          userId: args.userId,
          tier: 'pro',
          interval: args.interval,
        },
      },
      metadata: {
        organizationId: args.organizationId,
        dubCustomerExternalId: args.userId,
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
  const hasPaymentMethod = Boolean(state.account.paymentMethodBrand)
  const client = requireStripe()

  if (paymentMethodId && hasPaymentMethod) {
    try {
      const idempotencyKey = args.requestId ? `billing-topup-charge:${args.requestId}` : undefined
      const paymentIntent = await client.paymentIntents.create(
        {
          amount: Math.round(amountUsd * 100),
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          payment_method_types: ['card', 'link'],
          confirm: true,
          off_session: true,
          error_on_requires_action: true,
          description: 'Surgent usage balance top-up',
          metadata: {
            dubCustomerExternalId: args.userId,
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
    const inserted = await insertBillingPaymentEntry(tx, {
      organizationId: args.organizationId,
      kind: 'topup',
      amountMicros,
      status: 'paid',
      conflictColumn: 'stripePaymentIntentId',
      stripeInvoiceId: null,
      stripePaymentIntentId: paymentIntent.id,
      currency: paymentIntent.currency ?? 'usd',
      metadata: { amountUsd: paymentIntent.metadata?.amountUsd ?? null },
      createdAt: now,
      updatedAt: now,
    })

    if (!inserted) return
    await applyPrepaidBalanceDeltaTx(tx, args.organizationId, amountMicros, now)
  })

  const paymentMethod = paymentIntent.payment_method
  if (paymentMethod && typeof paymentMethod !== 'string') {
    await persistBillingPaymentMethod({
      organizationId: args.organizationId,
      paymentMethod,
      stripeCustomerId: customerId,
    })
  }

  await import('@/lib/referrals').then((m) => m.grantReferralConversionReward(args.organizationId))
  await trackDubSale({
    customerExternalId:
      paymentIntent.metadata?.dubCustomerExternalId ?? paymentIntent.metadata?.userId ?? '',
    amount: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency ?? 'usd',
    eventName: 'Balance Top-up',
    invoiceId: paymentIntent.id,
    metadata: {
      kind: 'topup',
      organizationId: args.organizationId,
      stripePaymentIntentId: paymentIntent.id,
    },
  })

  return true
}

export async function createBillingPortal(args: {
  organizationId: string
  returnPath?: string | null
}) {
  const snapshot = await getBillingBaseSnapshot(args.organizationId)
  if (!snapshot.stripeCustomerId) throw new Error('No Stripe customer found for this organization')

  const client = requireStripe()
  const session = await client.billingPortal.sessions.create({
    customer: snapshot.stripeCustomerId,
    return_url: billingReturnUrl(args.returnPath, 'return'),
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
  const createdAt =
    typeof args.session.created === 'number' ? new Date(args.session.created * 1000) : new Date()
  const updatedAt = new Date()

  await db.transaction().execute(async (tx) => {
    await ensureBillingStateTx(tx, args.organizationId)
    const inserted = await insertBillingPaymentEntry(tx, {
      organizationId: args.organizationId,
      kind: 'topup',
      amountMicros,
      status: args.session.payment_status,
      conflictColumn: 'stripeCheckoutSessionId',
      stripeInvoiceId:
        typeof args.session.invoice === 'string' ? args.session.invoice : args.session.invoice?.id,
      stripeCheckoutSessionId: args.session.id,
      stripePaymentIntentId: paymentIntentId ?? null,
      metadata: { amountUsd: args.session.metadata?.amountUsd ?? null },
      createdAt,
      updatedAt,
    })

    if (!inserted) return
    await applyPrepaidBalanceDeltaTx(tx, args.organizationId, amountMicros, updatedAt)
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

  if (args.session.payment_status === 'paid') {
    await import('@/lib/referrals').then((m) =>
      m.grantReferralConversionReward(args.organizationId),
    )
    await trackDubSale({
      customerExternalId:
        args.session.metadata?.dubCustomerExternalId ?? args.session.metadata?.userId ?? '',
      amount: args.session.amount_total ?? 0,
      currency: args.session.currency ?? 'usd',
      eventName: 'Balance Top-up',
      invoiceId:
        (typeof args.session.invoice === 'string'
          ? args.session.invoice
          : args.session.invoice?.id) ??
        paymentIntentId ??
        args.session.id,
      metadata: {
        kind: 'topup',
        organizationId: args.organizationId,
        stripeCheckoutSessionId: args.session.id,
        stripePaymentIntentId: paymentIntentId ?? null,
      },
    })
  }
}

async function resolveDubCustomerExternalIdForInvoice(invoice: Stripe.Invoice) {
  if (invoice.metadata?.dubCustomerExternalId) return invoice.metadata.dubCustomerExternalId
  if (invoice.metadata?.userId) return invoice.metadata.userId

  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id
  if (!subscriptionId) return null

  try {
    const subscription = await requireStripe().subscriptions.retrieve(subscriptionId)
    return subscription.metadata.dubCustomerExternalId || subscription.metadata.userId || null
  } catch {
    return null
  }
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
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id
  if (!subscriptionId) return

  const paymentIntent = invoice.payments?.data[0]?.payment.payment_intent
  const paymentIntentId =
    typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent?.id ?? null)
  const amountMicros = centsToMicros(
    args.status === 'paid' ? invoice.amount_paid : invoice.amount_due,
  )
  const discount = getDiscountIds(invoice.discounts)
  const dubCustomerExternalId = await resolveDubCustomerExternalIdForInvoice(invoice)

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
      metadata: {},
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
        metadata: {},
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

  if (args.status === 'paid') {
    await import('@/lib/referrals').then((m) =>
      m.grantReferralConversionReward(args.organizationId),
    )
    await trackDubSale({
      customerExternalId: dubCustomerExternalId ?? '',
      amount: invoice.amount_paid,
      currency: invoice.currency ?? 'usd',
      eventName: 'Subscription Payment',
      invoiceId: invoice.id,
      metadata: {
        kind: 'subscription',
        organizationId: args.organizationId,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
      },
    })
  }
}

export async function refundBillingPayment(args: {
  organizationId: string
  stripePaymentIntentId: string
  refundedAmountMicros: number
  refundedAt: Date
  stripeEventId?: string | null
}) {
  await db.transaction().execute(async (tx) => {
    const payment = await tx
      .selectFrom('billing_payment')
      .selectAll()
      .where('organizationId', '=', args.organizationId)
      .where('stripePaymentIntentId', '=', args.stripePaymentIntentId)
      .orderBy('createdAt', 'desc')
      .forUpdate()
      .executeTakeFirst()

    if (!payment) return

    const previousRefundedMicros = asNumber(payment.refundedAmountMicros)
    const deltaMicros = Math.max(args.refundedAmountMicros - previousRefundedMicros, 0)
    if (!deltaMicros) return

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

    if (payment.kind !== 'topup') return

    await applyPrepaidBalanceDeltaTx(tx, args.organizationId, -deltaMicros)
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
    nextResetAt: snapshot.nextResetAt,
  }
}

export async function listBillingStateForUsage(organizationId: string) {
  const row = await getBillingState(organizationId)
  const now = new Date()
  const allowanceWindow = getAllowanceWindow(
    {
      tier: row.subscription.tier,
      interval: row.subscription.interval,
      currentPeriodStart: row.subscription.currentPeriodStart,
      currentPeriodEnd: row.subscription.currentPeriodEnd,
    },
    now,
  )
  return {
    organizationId,
    includedRemainingMicros: getEffectiveIncludedBalance(row, now),
    prepaidBalanceMicros: asNumber(row.account.prepaidBalanceMicros),
    monthlySpendLimitMicros: asNumber(row.account.monthlySpendLimitMicros),
    monthlyAllowanceMicros: asNumber(row.subscription.monthlyAllowanceMicros),
    currentPeriodStart: allowanceWindow.start,
    nextResetAt: allowanceWindow.end,
    tier: row.subscription.tier,
    status: row.subscription.status,
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
    const inserted = await insertBillingPaymentEntry(tx, {
      organizationId: args.organizationId,
      kind: 'reward',
      amountMicros,
      status: 'paid',
      conflictColumn: 'idempotencyKey',
      idempotencyKey: args.idempotencyKey,
      metadata: {
        reason: args.reason,
        ...(args.metadata ?? {}),
      },
    })
    if (!inserted) return
    await applyPrepaidBalanceDeltaTx(tx, args.organizationId, amountMicros)
  })
}
