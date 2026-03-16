import { type Kysely, sql } from 'kysely'

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

function getAnchoredMonthlyBounds(now: Date, anchorDate: Date) {
  const day = anchorDate.getUTCDate()
  const hh = anchorDate.getUTCHours()
  const mm = anchorDate.getUTCMinutes()
  const ss = anchorDate.getUTCSeconds()
  const ms = anchorDate.getUTCMilliseconds()

  function anchor(year: number, month: number) {
    const max = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(day, max), hh, mm, ss, ms))
  }

  function shift(year: number, month: number, delta: number) {
    const total = year * 12 + month + delta
    return [Math.floor(total / 12), ((total % 12) + 12) % 12] as const
  }

  let y = now.getUTCFullYear()
  let m = now.getUTCMonth()
  let start = anchor(y, m)
  if (start > now) {
    ;[y, m] = shift(y, m, -1)
    start = anchor(y, m)
  }
  const [ny, nm] = shift(y, m, 1)
  const end = anchor(ny, nm)
  return { start, end }
}

function getAllowanceWindow(
  args: {
    tier: string | null
    interval: string | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
  },
  now = new Date(),
) {
  if (args.tier === 'free') {
    const start = startOfMonth(now)
    return {
      start,
      end: addMonths(start, 1),
    }
  }

  if (!args.currentPeriodStart) {
    const start = startOfMonth(now)
    return {
      start,
      end: addMonths(start, 1),
    }
  }

  if (args.interval === 'year') {
    return getAnchoredMonthlyBounds(now, args.currentPeriodStart)
  }

  return {
    start: args.currentPeriodStart,
    end: args.currentPeriodEnd ?? addMonths(args.currentPeriodStart, 1),
  }
}

const MONEY_SCALE = 100_000_000
const DEFAULT_FREE_MONTHLY_SPEND_LIMIT_USD = 2

export async function up(db: Kysely<any>): Promise<void> {
  const currentTime = new Date()
  const freeMonthlySpendLimitMicros = Math.round(DEFAULT_FREE_MONTHLY_SPEND_LIMIT_USD * MONEY_SCALE)

  await sql`
    ALTER TABLE billing_account
    ADD COLUMN IF NOT EXISTS "includedBalanceMicros" bigint NOT NULL DEFAULT 0
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    ADD COLUMN IF NOT EXISTS "includedBalancePeriodStart" timestamptz
  `.execute(db)

  await sql`
    ALTER TABLE usage
    ADD COLUMN IF NOT EXISTS "providerCostMicros" bigint
  `.execute(db)

  await sql`
    ALTER TABLE usage
    ADD COLUMN IF NOT EXISTS "billedCostMicros" bigint
  `.execute(db)

  await sql`
    ALTER TABLE usage
    ADD COLUMN IF NOT EXISTS "markupBps" integer
  `.execute(db)

  await sql`
    ALTER TABLE usage
    ADD COLUMN IF NOT EXISTS "billingMode" text
  `.execute(db)

  await sql`
    UPDATE usage
    SET
      "billedCostMicros" = COALESCE("billedCostMicros", cost),
      "providerCostMicros" = COALESCE("providerCostMicros", ROUND(cost::numeric / 1.3)::bigint),
      "markupBps" = COALESCE("markupBps", 3000),
      "billingMode" = COALESCE("billingMode", 'legacy')
    WHERE
      "billedCostMicros" IS NULL
      OR "providerCostMicros" IS NULL
      OR "markupBps" IS NULL
      OR "billingMode" IS NULL
  `.execute(db)

  await sql`
    UPDATE billing_account AS account
    SET "stripeCustomerId" = organization."stripeCustomerId"
    FROM organization
    WHERE organization.id = account."organizationId"
      AND account."stripeCustomerId" IS NULL
      AND organization."stripeCustomerId" IS NOT NULL
  `.execute(db)

  await sql`
    UPDATE billing_account AS account
    SET "monthlySpendLimitMicros" = ${String(freeMonthlySpendLimitMicros)}
    FROM billing_subscription AS subscription
    WHERE subscription."organizationId" = account."organizationId"
      AND subscription.tier = 'free'
      AND account."monthlySpendLimitMicros" IS NULL
  `.execute(db)

  const states = await db
    .selectFrom('billing_account as account')
    .innerJoin(
      'billing_subscription as subscription',
      'subscription.organizationId',
      'account.organizationId',
    )
    .select([
      'account.id as accountId',
      'account.monthlySpendUsagePeriodStart',
      'subscription.tier',
      'subscription.interval',
      'subscription.currentPeriodStart',
      'subscription.currentPeriodEnd',
      'subscription.monthlyAllowanceMicros',
      'subscription.includedUsageMicros',
      'subscription.includedUsagePeriodStart',
    ])
    .execute()

  for (const state of states) {
    const allowanceWindow = getAllowanceWindow(
      {
        tier: state.tier,
        interval: state.interval,
        currentPeriodStart: state.currentPeriodStart,
        currentPeriodEnd: state.currentPeriodEnd,
      },
      currentTime,
    )
    const allowance = asNumber(state.monthlyAllowanceMicros)
    const includedUsed =
      state.includedUsagePeriodStart?.getTime() === allowanceWindow.start.getTime()
        ? asNumber(state.includedUsageMicros)
        : 0
    const includedBalanceMicros = Math.max(allowance - includedUsed, 0)
    const includedBalancePeriodStart = allowance > 0 ? allowanceWindow.start : null
    await db
      .updateTable('billing_account')
      .set({
        includedBalanceMicros: String(includedBalanceMicros),
        includedBalancePeriodStart,
        updatedAt: currentTime,
      })
      .where('id', '=', state.accountId)
      .execute()
  }

  await sql`
    ALTER TABLE billing_subscription
    DROP COLUMN IF EXISTS "includedUsagePeriodStart"
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    DROP COLUMN IF EXISTS "includedUsageMicros"
  `.execute(db)

  await sql`
    ALTER TABLE organization
    DROP COLUMN IF EXISTS "stripeCustomerId"
  `.execute(db)

  await sql`
    ALTER TABLE usage
    DROP COLUMN IF EXISTS cost
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE usage
    ADD COLUMN IF NOT EXISTS cost bigint NOT NULL DEFAULT 0
  `.execute(db)

  await sql`
    UPDATE usage
    SET cost = COALESCE("billedCostMicros", 0)
    WHERE cost = 0
  `.execute(db)

  await sql`
    ALTER TABLE organization
    ADD COLUMN IF NOT EXISTS "stripeCustomerId" text
  `.execute(db)

  await sql`
    UPDATE organization AS organization
    SET "stripeCustomerId" = account."stripeCustomerId"
    FROM billing_account AS account
    WHERE account."organizationId" = organization.id
      AND organization."stripeCustomerId" IS NULL
      AND account."stripeCustomerId" IS NOT NULL
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    ADD COLUMN IF NOT EXISTS "includedUsageMicros" bigint NOT NULL DEFAULT 0
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    ADD COLUMN IF NOT EXISTS "includedUsagePeriodStart" timestamptz
  `.execute(db)

  const states = await db
    .selectFrom('billing_account as account')
    .innerJoin(
      'billing_subscription as subscription',
      'subscription.organizationId',
      'account.organizationId',
    )
    .select([
      'subscription.organizationId',
      'subscription.monthlyAllowanceMicros',
      'account.includedBalanceMicros',
      'account.includedBalancePeriodStart',
    ])
    .execute()

  for (const state of states) {
    const allowance = asNumber(state.monthlyAllowanceMicros)
    const balance = asNumber(state.includedBalanceMicros)
    await db
      .updateTable('billing_subscription')
      .set({
        includedUsageMicros: String(Math.max(allowance - balance, 0)),
        includedUsagePeriodStart: state.includedBalancePeriodStart,
      })
      .where('organizationId', '=', state.organizationId)
      .execute()
  }

  await sql`
    ALTER TABLE usage
    DROP COLUMN IF EXISTS "billingMode"
  `.execute(db)

  await sql`
    ALTER TABLE usage
    DROP COLUMN IF EXISTS "markupBps"
  `.execute(db)

  await sql`
    ALTER TABLE usage
    DROP COLUMN IF EXISTS "billedCostMicros"
  `.execute(db)

  await sql`
    ALTER TABLE usage
    DROP COLUMN IF EXISTS "providerCostMicros"
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    DROP COLUMN IF EXISTS "includedBalancePeriodStart"
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    DROP COLUMN IF EXISTS "includedBalanceMicros"
  `.execute(db)
}
