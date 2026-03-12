import { type Kysely, sql } from 'kysely'

const pk = (col: any) => col.primaryKey().defaultTo(sql`gen_random_uuid()`)
const now = (col: any) => col.notNull().defaultTo(sql`now()`)
const jsonb = (col: any) => col.notNull().defaultTo(sql`'{}'::jsonb`)
const money = (col: any) => col.notNull().defaultTo(0)

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

export async function up(db: Kysely<any>): Promise<void> {
  const currentTime = new Date()

  await sql`
    ALTER TABLE billing_account
    ADD COLUMN IF NOT EXISTS "monthlySpendUsageMicros" bigint NOT NULL DEFAULT 0
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    ADD COLUMN IF NOT EXISTS "monthlySpendUsagePeriodStart" timestamptz
  `.execute(db)

  await sql`
    ALTER TABLE billing_payment
    ADD COLUMN IF NOT EXISTS "idempotencyKey" text
  `.execute(db)

  await sql`
    ALTER TABLE billing_payment
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  `.execute(db)

  await db.schema
    .createIndex('billing_payment_idempotency_uq')
    .ifNotExists()
    .on('billing_payment')
    .column('idempotencyKey')
    .unique()
    .execute()

  const rewards = await db
    .selectFrom('billing_ledger')
    .selectAll()
    .where('kind', '=', 'reward')
    .execute()

  for (const reward of rewards) {
    await db
      .insertInto('billing_payment')
      .values({
        id: crypto.randomUUID(),
        organizationId: reward.organizationId,
        kind: 'reward',
        stripeInvoiceId: reward.stripeInvoiceId,
        stripePaymentIntentId: reward.stripePaymentIntentId,
        stripeCheckoutSessionId: reward.stripeCheckoutSessionId,
        stripeCouponId: null,
        stripeDiscountId: null,
        stripePromotionCodeId: null,
        amountMicros: reward.amountMicros,
        refundedAmountMicros: '0',
        refundedAt: null,
        currency: 'usd',
        status: 'paid',
        idempotencyKey: reward.idempotencyKey,
        metadata: reward.metadata && typeof reward.metadata === 'object' ? reward.metadata : {},
        createdAt: reward.createdAt,
        updatedAt: reward.createdAt ?? new Date(),
      })
      .onConflict((oc) => oc.column('idempotencyKey').doNothing())
      .execute()
  }

  const states = await db
    .selectFrom('billing_account as account')
    .innerJoin(
      'billing_subscription as subscription',
      'subscription.organizationId',
      'account.organizationId',
    )
    .select([
      'account.id as accountId',
      'account.organizationId',
      'subscription.tier',
      'subscription.interval',
      'subscription.currentPeriodStart',
      'subscription.currentPeriodEnd',
    ])
    .execute()

  for (const state of states) {
    const periodStart = getAllowanceWindow(
      {
        tier: state.tier,
        interval: state.interval,
        currentPeriodStart: state.currentPeriodStart,
        currentPeriodEnd: state.currentPeriodEnd,
      },
      currentTime,
    ).start

    const spent = await db
      .selectFrom('billing_ledger')
      .select(
        sql<string>`COALESCE(SUM(CASE WHEN "kind" = 'usage_debit' THEN ABS("amountMicros") ELSE 0 END), 0)`.as(
          'spentMicros',
        ),
      )
      .where('organizationId', '=', state.organizationId)
      .where('createdAt', '>=', periodStart)
      .executeTakeFirst()

    const amount = asNumber(spent?.spentMicros)
    await db
      .updateTable('billing_account')
      .set({
        monthlySpendUsageMicros: String(amount),
        monthlySpendUsagePeriodStart: amount > 0 ? periodStart : null,
        updatedAt: currentTime,
      })
      .where('id', '=', state.accountId)
      .execute()
  }

  await db.schema.dropTable('billing_ledger').ifExists().execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('billing_ledger')
    .ifNotExists()
    .addColumn('id', 'uuid', pk)
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('bucket', 'text', (col) => col.notNull())
    .addColumn('amountMicros', 'bigint', money)
    .addColumn('stripeEventId', 'text')
    .addColumn('stripeInvoiceId', 'text')
    .addColumn('stripeCheckoutSessionId', 'text')
    .addColumn('stripePaymentIntentId', 'text')
    .addColumn('usageId', 'uuid', (col) => col.references('usage.id').onDelete('set null'))
    .addColumn('idempotencyKey', 'text')
    .addColumn('metadata', 'jsonb', jsonb)
    .addColumn('createdAt', 'timestamptz', now)
    .execute()

  await db.schema
    .createIndex('billing_ledger_org_created_idx')
    .ifNotExists()
    .on('billing_ledger')
    .columns(['organizationId', 'createdAt'])
    .execute()

  await db.schema
    .createIndex('billing_ledger_idempotency_uq')
    .ifNotExists()
    .on('billing_ledger')
    .column('idempotencyKey')
    .unique()
    .execute()

  await sql`ALTER TABLE billing_ledger ADD CONSTRAINT billing_ledger_kind_check CHECK ("kind" IN ('subscription_allowance', 'topup_purchase', 'auto_reload', 'usage_debit', 'refund', 'manual_adjustment', 'reward'))`.execute(
    db,
  )
  await sql`ALTER TABLE billing_ledger ADD CONSTRAINT billing_ledger_bucket_check CHECK ("bucket" IN ('included', 'prepaid'))`.execute(
    db,
  )

  await db.schema.dropIndex('billing_payment_idempotency_uq').ifExists().execute()

  await sql`
    ALTER TABLE billing_payment
    DROP COLUMN IF EXISTS metadata
  `.execute(db)

  await sql`
    ALTER TABLE billing_payment
    DROP COLUMN IF EXISTS "idempotencyKey"
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    DROP COLUMN IF EXISTS "monthlySpendUsagePeriodStart"
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    DROP COLUMN IF EXISTS "monthlySpendUsageMicros"
  `.execute(db)
}
