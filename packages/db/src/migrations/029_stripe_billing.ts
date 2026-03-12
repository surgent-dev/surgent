import { type Kysely, sql } from 'kysely'

const pk = (col: any) => col.primaryKey().defaultTo(sql`gen_random_uuid()`)
const now = (col: any) => col.notNull().defaultTo(sql`now()`)
const currency = (col: any) => col.notNull().defaultTo('usd')
const jsonb = (col: any) => col.notNull().defaultTo(sql`'{}'::jsonb`)
const money = (col: any) => col.notNull().defaultTo(0)

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE organization ADD COLUMN IF NOT EXISTS "stripeCustomerId" text`.execute(db)

  await db.schema
    .createTable('billing_account')
    .ifNotExists()
    .addColumn('id', 'uuid', pk)
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('stripeCustomerId', 'text')
    .addColumn('defaultPaymentMethodId', 'text')
    .addColumn('paymentMethodBrand', 'text')
    .addColumn('paymentMethodLast4', 'varchar(4)')
    .addColumn('includedBalanceMicros', 'bigint', money)
    .addColumn('prepaidBalanceMicros', 'bigint', money)
    .addColumn('autoReloadEnabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('autoReloadThresholdMicros', 'bigint')
    .addColumn('autoReloadAmountMicros', 'bigint')
    .addColumn('monthlySpendLimitMicros', 'bigint')
    .addColumn('currency', 'varchar(3)', currency)
    .addColumn('createdAt', 'timestamptz', now)
    .addColumn('updatedAt', 'timestamptz', now)
    .execute()

  await db.schema
    .createIndex('organization_stripe_customer_uq')
    .ifNotExists()
    .on('organization')
    .column('stripeCustomerId')
    .unique()
    .execute()

  await db.schema
    .createIndex('billing_account_org_uq')
    .ifNotExists()
    .on('billing_account')
    .column('organizationId')
    .unique()
    .execute()

  await db.schema
    .createIndex('billing_account_customer_uq')
    .ifNotExists()
    .on('billing_account')
    .column('stripeCustomerId')
    .unique()
    .execute()

  await db.schema
    .createTable('billing_subscription')
    .ifNotExists()
    .addColumn('id', 'uuid', pk)
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('stripeSubscriptionId', 'text')
    .addColumn('stripePriceId', 'text')
    .addColumn('tier', 'text', (col) => col.notNull().defaultTo('free'))
    .addColumn('interval', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('free'))
    .addColumn('trialStart', 'timestamptz')
    .addColumn('trialEnd', 'timestamptz')
    .addColumn('currentPeriodStart', 'timestamptz')
    .addColumn('currentPeriodEnd', 'timestamptz')
    .addColumn('cancelAtPeriodEnd', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('canceledAt', 'timestamptz')
    .addColumn('monthlyAllowanceMicros', 'bigint', money)
    .addColumn('nextAllowanceGrantAt', 'timestamptz')
    .addColumn('stripeCouponId', 'text')
    .addColumn('stripeDiscountId', 'text')
    .addColumn('stripePromotionCodeId', 'text')
    .addColumn('createdAt', 'timestamptz', now)
    .addColumn('updatedAt', 'timestamptz', now)
    .execute()

  await db.schema
    .createIndex('billing_subscription_org_uq')
    .ifNotExists()
    .on('billing_subscription')
    .column('organizationId')
    .unique()
    .execute()

  await db.schema
    .createIndex('billing_subscription_stripe_uq')
    .ifNotExists()
    .on('billing_subscription')
    .column('stripeSubscriptionId')
    .unique()
    .execute()

  await sql`ALTER TABLE billing_subscription ADD CONSTRAINT billing_subscription_tier_check CHECK ("tier" IN ('free', 'pro'))`.execute(
    db,
  )
  await sql`ALTER TABLE billing_subscription ADD CONSTRAINT billing_subscription_interval_check CHECK ("interval" IS NULL OR "interval" IN ('month', 'year'))`.execute(
    db,
  )
  await sql`ALTER TABLE billing_subscription ADD CONSTRAINT billing_subscription_status_check CHECK ("status" IN ('free', 'active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired'))`.execute(
    db,
  )

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

  await db.schema
    .createTable('billing_event')
    .ifNotExists()
    .addColumn('stripeEventId', 'text', (col) => col.primaryKey())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('error', 'text')
    .addColumn('receivedAt', 'timestamptz', now)
    .addColumn('handledAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('billing_event_status_received_idx')
    .ifNotExists()
    .on('billing_event')
    .columns(['status', 'receivedAt'])
    .execute()

  await db.schema
    .createTable('billing_payment')
    .ifNotExists()
    .addColumn('id', 'uuid', pk)
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('stripeInvoiceId', 'text')
    .addColumn('stripePaymentIntentId', 'text')
    .addColumn('stripeCheckoutSessionId', 'text')
    .addColumn('stripeCouponId', 'text')
    .addColumn('stripeDiscountId', 'text')
    .addColumn('stripePromotionCodeId', 'text')
    .addColumn('amountMicros', 'bigint', money)
    .addColumn('refundedAmountMicros', 'bigint', money)
    .addColumn('refundedAt', 'timestamptz')
    .addColumn('currency', 'varchar(3)', currency)
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', now)
    .addColumn('updatedAt', 'timestamptz', now)
    .execute()

  await db.schema
    .createIndex('billing_payment_org_created_idx')
    .ifNotExists()
    .on('billing_payment')
    .columns(['organizationId', 'createdAt'])
    .execute()

  await db.schema
    .createIndex('billing_payment_checkout_uq')
    .ifNotExists()
    .on('billing_payment')
    .column('stripeCheckoutSessionId')
    .unique()
    .execute()

  await db.schema
    .createIndex('billing_payment_invoice_uq')
    .ifNotExists()
    .on('billing_payment')
    .column('stripeInvoiceId')
    .unique()
    .execute()

  await db.schema
    .createIndex('billing_payment_intent_uq')
    .ifNotExists()
    .on('billing_payment')
    .column('stripePaymentIntentId')
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('billing_payment').ifExists().execute()
  await db.schema.dropTable('billing_event').ifExists().execute()
  await db.schema.dropTable('billing_ledger').ifExists().execute()
  await db.schema.dropTable('billing_subscription').ifExists().execute()
  await db.schema.dropTable('billing_account').ifExists().execute()
  await db.schema.alterTable('organization').dropColumn('stripeCustomerId').execute()
}
