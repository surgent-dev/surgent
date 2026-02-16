import { type Kysely, sql } from 'kysely'
import type { CreateTableBuilder, ColumnDefinitionBuilder } from 'kysely'

const pk = (col: ColumnDefinitionBuilder) => col.primaryKey().defaultTo(sql`gen_random_uuid()`)
const jsonb = (col: ColumnDefinitionBuilder) => col.notNull().defaultTo(sql`'{}'::jsonb`)
const now = (col: ColumnDefinitionBuilder) => col.notNull().defaultTo(sql`now()`)
const env = (col: ColumnDefinitionBuilder) => col.notNull().defaultTo('live')
const money = (col: ColumnDefinitionBuilder) => col.notNull().defaultTo(0)
const currency = (col: ColumnDefinitionBuilder) => col.notNull().defaultTo('usd')

function withTimestamps<T extends string>(t: CreateTableBuilder<T, never>) {
  return t
    .addColumn('env', 'text', env)
    .addColumn('createdAt', 'timestamptz', now)
    .addColumn('updatedAt', 'timestamptz', now)
}

function idx(db: Kysely<any>, name: string, table: string) {
  return {
    on: (...cols: string[]) =>
      db.schema.createIndex(name).ifNotExists().on(table).columns(cols).execute(),
    unique: (...cols: string[]) =>
      db.schema.createIndex(name).ifNotExists().on(table).columns(cols).unique().execute(),
  }
}

export async function up(db: Kysely<any>): Promise<void> {
  // ── pay_account ──

  await withTimestamps(
    db.schema
      .createTable('pay_account')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) =>
        c.notNull().references('project.id').onDelete('cascade'),
      )
      .addColumn('userId', 'uuid', (c) => c.notNull().references('user.id').onDelete('cascade'))
      .addColumn('whopCompanyId', 'text', (c) => c.notNull())
      .addColumn('title', 'text', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
      .addColumn('metadata', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_account_project_user_env_uq', 'pay_account').unique(
    'projectId',
    'userId',
    'env',
  )
  await idx(db, 'pay_account_whop_company_env_uq', 'pay_account').unique('whopCompanyId', 'env')
  await idx(db, 'pay_account_project_env_idx', 'pay_account').on('projectId', 'env')

  // ── pay_checkout_session ──

  await withTimestamps(
    db.schema
      .createTable('pay_checkout_session')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) =>
        c.notNull().references('project.id').onDelete('cascade'),
      )
      .addColumn('userId', 'uuid', (c) => c.references('user.id').onDelete('set null'))
      .addColumn('accountId', 'uuid', (c) => c.references('pay_account.id').onDelete('set null'))
      .addColumn('whopCompanyId', 'text', (c) => c.notNull())
      .addColumn('whopCheckoutId', 'text')
      .addColumn('purchaseUrl', 'text')
      .addColumn('mode', 'text', (c) => c.notNull().defaultTo('payment'))
      .addColumn('planType', 'text', (c) => c.notNull().defaultTo('one_time'))
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('open'))
      .addColumn('amount', 'bigint')
      .addColumn('currency', 'varchar(3)', currency)
      .addColumn('idempotencyKey', 'text')
      .addColumn('metadata', 'jsonb', jsonb),
  )
    .addColumn('completedAt', 'timestamptz')
    .execute()

  await idx(db, 'pay_checkout_whop_id_uq', 'pay_checkout_session').unique('whopCheckoutId')
  await idx(db, 'pay_checkout_project_created_idx', 'pay_checkout_session').on(
    'projectId',
    'createdAt',
  )
  await idx(db, 'pay_checkout_idem_env_uq', 'pay_checkout_session').unique(
    'projectId',
    'idempotencyKey',
    'env',
  )
  await idx(db, 'pay_checkout_project_env_idx', 'pay_checkout_session').on('projectId', 'env')

  // ── pay_webhook_event ──

  await db.schema
    .createTable('pay_webhook_event')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('eventType', 'text', (c) => c.notNull())
    .addColumn('payload', 'jsonb', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('pending'))
    .addColumn('error', 'text')
    .addColumn('env', 'text', env)
    .addColumn('receivedAt', 'timestamptz', now)
    .addColumn('handledAt', 'timestamptz')
    .execute()

  await idx(db, 'pay_webhook_status_received_idx', 'pay_webhook_event').on('status', 'receivedAt')
  await idx(db, 'pay_webhook_env_status_idx', 'pay_webhook_event').on('env', 'status')

  // ── pay_customer ──

  await withTimestamps(
    db.schema
      .createTable('pay_customer')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) =>
        c.notNull().references('project.id').onDelete('cascade'),
      )
      .addColumn('externalId', 'text')
      .addColumn('email', 'text')
      .addColumn('name', 'text')
      .addColumn('metadata', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_customer_project_ext_env_uq', 'pay_customer').unique(
    'projectId',
    'externalId',
    'env',
  )
  await idx(db, 'pay_customer_project_email_idx', 'pay_customer').on('projectId', 'email')

  // ── pay_payment ──

  await withTimestamps(
    db.schema
      .createTable('pay_payment')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) => c.references('project.id').onDelete('set null'))
      .addColumn('checkoutId', 'uuid', (c) =>
        c.references('pay_checkout_session.id').onDelete('set null'),
      )
      .addColumn('customerId', 'uuid', (c) => c.references('pay_customer.id').onDelete('set null'))
      .addColumn('whopPaymentId', 'text', (c) => c.notNull())
      .addColumn('whopCompanyId', 'text')
      .addColumn('whopUserId', 'text')
      .addColumn('amount', 'bigint', money)
      .addColumn('currency', 'varchar(3)', currency)
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('customerEmail', 'text')
      .addColumn('customerName', 'text')
      .addColumn('paidAt', 'timestamptz')
      .addColumn('billingReason', 'text')
      .addColumn('paymentMethodType', 'text')
      .addColumn('cardBrand', 'text')
      .addColumn('cardLast4', 'varchar(4)')
      .addColumn('failureMessage', 'text')
      .addColumn('metadata', 'jsonb', jsonb)
      .addColumn('raw', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_payment_whop_id_env_uq', 'pay_payment').unique('whopPaymentId', 'env')
  await idx(db, 'pay_payment_project_created_idx', 'pay_payment').on('projectId', 'createdAt')
  await idx(db, 'pay_payment_project_env_idx', 'pay_payment').on('projectId', 'env')
  await idx(db, 'pay_payment_customer_idx', 'pay_payment').on('customerId')
  await sql`CREATE INDEX IF NOT EXISTS pay_payment_metadata_gin ON pay_payment USING GIN (metadata jsonb_path_ops)`.execute(
    db,
  )
  await sql`CREATE INDEX IF NOT EXISTS pay_payment_project_env_whop_user_idx ON pay_payment ("projectId", env, "whopUserId")`.execute(
    db,
  )
  await sql`CREATE INDEX IF NOT EXISTS pay_payment_project_env_customer_email_idx ON pay_payment ("projectId", env, "customerEmail")`.execute(
    db,
  )

  // ── pay_subscription ──

  await withTimestamps(
    db.schema
      .createTable('pay_subscription')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) => c.references('project.id').onDelete('set null'))
      .addColumn('checkoutId', 'uuid', (c) =>
        c.references('pay_checkout_session.id').onDelete('set null'),
      )
      .addColumn('customerId', 'uuid', (c) => c.references('pay_customer.id').onDelete('set null'))
      .addColumn('whopMembershipId', 'text', (c) => c.notNull())
      .addColumn('whopPlanId', 'text')
      .addColumn('whopProductId', 'text')
      .addColumn('whopUserId', 'text')
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('cancelAtPeriodEnd', 'boolean', (c) => c.notNull().defaultTo(false))
      .addColumn('currentPeriodStart', 'timestamptz')
      .addColumn('currentPeriodEnd', 'timestamptz')
      .addColumn('canceledAt', 'timestamptz')
      .addColumn('metadata', 'jsonb', jsonb)
      .addColumn('raw', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_sub_whop_id_env_uq', 'pay_subscription').unique('whopMembershipId', 'env')
  await idx(db, 'pay_sub_project_created_idx', 'pay_subscription').on('projectId', 'createdAt')
  await idx(db, 'pay_sub_whop_user_idx', 'pay_subscription').on('whopUserId')
  await idx(db, 'pay_sub_project_env_idx', 'pay_subscription').on('projectId', 'env')
  await idx(db, 'pay_sub_customer_idx', 'pay_subscription').on('customerId')

  // ── pay_invoice ──

  await withTimestamps(
    db.schema
      .createTable('pay_invoice')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) => c.references('project.id').onDelete('set null'))
      .addColumn('checkoutId', 'uuid', (c) =>
        c.references('pay_checkout_session.id').onDelete('set null'),
      )
      .addColumn('subscriptionId', 'uuid', (c) =>
        c.references('pay_subscription.id').onDelete('set null'),
      )
      .addColumn('whopInvoiceId', 'text', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('amount', 'bigint', money)
      .addColumn('currency', 'varchar(3)', currency)
      .addColumn('hostedUrl', 'text')
      .addColumn('dueAt', 'timestamptz')
      .addColumn('paidAt', 'timestamptz')
      .addColumn('voidedAt', 'timestamptz')
      .addColumn('metadata', 'jsonb', jsonb)
      .addColumn('raw', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_invoice_whop_id_env_uq', 'pay_invoice').unique('whopInvoiceId', 'env')
  await idx(db, 'pay_invoice_project_created_idx', 'pay_invoice').on('projectId', 'createdAt')

  // ── pay_refund ──

  await withTimestamps(
    db.schema
      .createTable('pay_refund')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) => c.references('project.id').onDelete('set null'))
      .addColumn('paymentId', 'uuid', (c) => c.references('pay_payment.id').onDelete('set null'))
      .addColumn('whopRefundId', 'text', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('amount', 'bigint', money)
      .addColumn('currency', 'varchar(3)', currency)
      .addColumn('reason', 'text')
      .addColumn('metadata', 'jsonb', jsonb)
      .addColumn('raw', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_refund_whop_id_env_uq', 'pay_refund').unique('whopRefundId', 'env')
  await idx(db, 'pay_refund_project_created_idx', 'pay_refund').on('projectId', 'createdAt')

  // ── pay_dispute ──

  await withTimestamps(
    db.schema
      .createTable('pay_dispute')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) => c.references('project.id').onDelete('set null'))
      .addColumn('paymentId', 'uuid', (c) => c.references('pay_payment.id').onDelete('set null'))
      .addColumn('whopDisputeId', 'text', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('amount', 'bigint', money)
      .addColumn('currency', 'varchar(3)', currency)
      .addColumn('reason', 'text')
      .addColumn('resolvedAt', 'timestamptz')
      .addColumn('metadata', 'jsonb', jsonb)
      .addColumn('raw', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_dispute_whop_id_env_uq', 'pay_dispute').unique('whopDisputeId', 'env')
  await idx(db, 'pay_dispute_project_created_idx', 'pay_dispute').on('projectId', 'createdAt')

  // ── pay_transaction ──

  await withTimestamps(
    db.schema
      .createTable('pay_transaction')
      .ifNotExists()
      .addColumn('id', 'uuid', pk)
      .addColumn('projectId', 'uuid', (c) => c.references('project.id').onDelete('set null'))
      .addColumn('accountId', 'uuid', (c) => c.references('pay_account.id').onDelete('set null'))
      .addColumn('checkoutId', 'uuid', (c) =>
        c.references('pay_checkout_session.id').onDelete('set null'),
      )
      .addColumn('paymentId', 'uuid', (c) => c.references('pay_payment.id').onDelete('set null'))
      .addColumn('subscriptionId', 'uuid', (c) =>
        c.references('pay_subscription.id').onDelete('set null'),
      )
      .addColumn('invoiceId', 'uuid', (c) => c.references('pay_invoice.id').onDelete('set null'))
      .addColumn('kind', 'text', (c) => c.notNull())
      .addColumn('processor', 'text', (c) => c.notNull().defaultTo('whop'))
      .addColumn('direction', 'text', (c) => c.notNull().defaultTo('neutral'))
      .addColumn('processorFeeType', 'text')
      .addColumn('paymentTransactionId', 'uuid', (c) =>
        c.references('pay_transaction.id').onDelete('set null'),
      )
      .addColumn('incurredByTransactionId', 'uuid', (c) =>
        c.references('pay_transaction.id').onDelete('set null'),
      )
      .addColumn('payoutTransactionId', 'uuid', (c) =>
        c.references('pay_transaction.id').onDelete('set null'),
      )
      .addColumn('sourceId', 'text')
      .addColumn('status', 'text')
      .addColumn('amount', 'bigint', money)
      .addColumn('currency', 'varchar(3)', currency)
      .addColumn('happenedAt', 'timestamptz')
      .addColumn('metadata', 'jsonb', jsonb)
      .addColumn('raw', 'jsonb', jsonb),
  ).execute()

  await idx(db, 'pay_tx_kind_source_env_uq', 'pay_transaction').unique('kind', 'sourceId', 'env')
  await idx(db, 'pay_tx_project_created_idx', 'pay_transaction').on('projectId', 'createdAt')
  await idx(db, 'pay_tx_account_created_idx', 'pay_transaction').on('accountId', 'createdAt')
  await idx(db, 'pay_tx_payment_idx', 'pay_transaction').on('paymentTransactionId')
  await idx(db, 'pay_tx_incurred_idx', 'pay_transaction').on('incurredByTransactionId')
  await idx(db, 'pay_tx_payout_idx', 'pay_transaction').on('payoutTransactionId')
  await idx(db, 'pay_tx_project_env_idx', 'pay_transaction').on('projectId', 'env')

  // ── existing table modifications ──

  await sql`ALTER TABLE apikey ADD COLUMN IF NOT EXISTS env text NOT NULL DEFAULT 'live'`.execute(
    db,
  )
  await idx(db, 'apikey_env_idx', 'apikey').on('env')

  await sql`UPDATE product SET env = 'live' WHERE env IS NULL`.execute(db)
  await sql`ALTER TABLE product ALTER COLUMN env SET DEFAULT 'live'`.execute(db)
  await sql`ALTER TABLE product ALTER COLUMN env SET NOT NULL`.execute(db)
  await sql`ALTER TABLE product DROP CONSTRAINT IF EXISTS product_project_id_slug_key`.execute(db)
  await idx(db, 'product_project_slug_env_uq', 'product').unique('projectId', 'slug', 'env')
  await idx(db, 'product_project_group_version_env_uq', 'product').unique(
    'projectId',
    'productGroup',
    'version',
    'env',
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS product_project_group_version_env_uq`.execute(db)
  await sql`DROP INDEX IF EXISTS product_project_slug_env_uq`.execute(db)
  await sql`ALTER TABLE product ALTER COLUMN env DROP NOT NULL`.execute(db)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_project_id_slug_key'
      ) THEN
        ALTER TABLE product ADD CONSTRAINT product_project_id_slug_key UNIQUE ("projectId", slug);
      END IF;
    END $$;
  `.execute(db)
  await sql`DROP INDEX IF EXISTS apikey_env_idx`.execute(db)
  await sql`ALTER TABLE apikey DROP COLUMN IF EXISTS env`.execute(db)

  const tables = [
    'pay_transaction',
    'pay_dispute',
    'pay_refund',
    'pay_invoice',
    'pay_subscription',
    'pay_payment',
    'pay_customer',
    'pay_webhook_event',
    'pay_checkout_session',
    'pay_account',
  ]
  for (const t of tables) {
    await db.schema.dropTable(t).ifExists().execute()
  }
}
