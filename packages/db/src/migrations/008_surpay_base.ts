import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Step 1: Create enums via raw SQL
  await sql`CREATE TYPE checkout_status AS ENUM ('open', 'complete', 'expired')`.execute(db)
  await sql`CREATE TYPE checkout_mode AS ENUM ('payment', 'subscription', 'setup')`.execute(db)
  await sql`CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired')`.execute(
    db,
  )
  await sql`CREATE TYPE payout_status AS ENUM ('paid', 'pending', 'in_transit', 'canceled', 'failed')`.execute(
    db,
  )
  await sql`CREATE TYPE recurring_interval AS ENUM ('day', 'week', 'month', 'year')`.execute(db)
  await sql`CREATE TYPE transaction_type AS ENUM ('payment', 'processor_fee', 'refund', 'dispute', 'balance', 'payout')`.execute(
    db,
  )
  await sql`CREATE TYPE payment_status AS ENUM ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded')`.execute(
    db,
  )
  await sql`CREATE TYPE dispute_status AS ENUM ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost')`.execute(
    db,
  )
  await sql`CREATE TYPE refund_status AS ENUM ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')`.execute(
    db,
  )
  await sql`CREATE TYPE feature_type AS ENUM ('metered', 'boolean')`.execute(db)
  await sql`CREATE TYPE meter_type AS ENUM ('consumable', 'non_consumable')`.execute(db)
  await sql`CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible')`.execute(
    db,
  )

  // Step 2: Extend organization table
  await db.schema
    .alterTable('organization')
    .addColumn('createdBy', 'text')
    .addColumn('platformFeePercent', 'integer')
    .addColumn('platformFeeFixed', 'integer')
    .execute()

  // Step 2: Extend project table
  await db.schema
    .alterTable('project')
    .addColumn('slug', 'text', (col) => col.notNull())
    .execute()

  // Step 3: Create Surpay tables

  // connect_account (renamed from account to avoid collision with auth account table)
  // Scoped to project so different projects can have different Stripe accounts
  await db.schema
    .createTable('connect_account')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.references('project.id'))
    .addColumn('country', 'varchar(2)', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('isPayoutsEnabled', 'boolean', (col) => col.notNull())
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorAccountId', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('detailsSubmitted', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('chargesEnabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('businessType', 'text')
    .addColumn('data', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // product
  await db.schema
    .createTable('product')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('productGroupId', 'uuid', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('version', 'integer')
    .addColumn('isArchived', 'boolean', (col) => col.defaultTo(false))
    .addColumn('isDefault', 'boolean')
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorProductId', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Extend product table with billing layer columns
  await db.schema
    .alterTable('product')
    .addColumn('isAddOn', 'boolean', (col) => col.defaultTo(false))
    .addColumn('planGroup', 'text')
    .addColumn('env', 'text', (col) => col.defaultTo('live'))
    .execute()

  // product_price
  await db.schema
    .createTable('product_price')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('productId', 'uuid', (col) => col.notNull().references('product.id'))
    .addColumn('name', 'text')
    .addColumn('description', 'text')
    .addColumn('priceAmount', 'integer', (col) => col.notNull())
    .addColumn('priceCurrency', 'varchar(3)', (col) => col.notNull())
    .addColumn('recurringInterval', sql`recurring_interval`)
    .addColumn('isDefault', 'boolean')
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorPriceId', 'text')
    .addColumn('slug', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // customer (defaultPaymentMethodId FK added later)
  await db.schema
    .createTable('customer')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('externalId', 'text', (col) => col.notNull())
    .addColumn('email', 'varchar(320)')
    .addColumn('name', 'text')
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorCustomerId', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // checkout_session
  await db.schema
    .createTable('checkout_session')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorCheckoutId', 'text', (col) => col.notNull())
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('productId', 'uuid', (col) => col.notNull().references('product.id'))
    .addColumn('priceId', 'uuid', (col) => col.notNull().references('product_price.id'))
    .addColumn('status', sql`checkout_status`, (col) => col.notNull().defaultTo('open'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('customerId', 'uuid', (col) => col.references('customer.id'))
    .addColumn('customerEmail', 'varchar(320)')
    .addColumn('processorCustomerId', 'text')
    .addColumn('processorPaymentId', 'text')
    .addColumn('processorSubscriptionId', 'text')
    .addColumn('successUrl', 'text')
    .addColumn('cancelUrl', 'text')
    .addColumn('mode', sql`checkout_mode`)
    .addColumn('completedAt', 'timestamptz')
    .execute()

  // payment_method
  await db.schema
    .createTable('payment_method')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorId', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('methodMetadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('customerId', 'uuid', (col) =>
      col.notNull().references('customer.id').onDelete('cascade'),
    )
    .execute()

  // subscription
  await db.schema
    .createTable('subscription')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('productId', 'uuid', (col) => col.references('product.id'))
    .addColumn('productPriceId', 'uuid', (col) => col.references('product_price.id'))
    .addColumn('customerId', 'uuid', (col) => col.references('customer.id'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('currentPeriodStart', 'timestamptz')
    .addColumn('currentPeriodEnd', 'timestamptz')
    .addColumn('canceledAt', 'timestamptz')
    .addColumn('endedAt', 'timestamptz')
    .addColumn('status', sql`subscription_status`, (col) => col.notNull())
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorSubscriptionId', 'text')
    .addColumn('processorCustomerId', 'text')
    .addColumn('cancelAtPeriodEnd', 'boolean', (col) => col.defaultTo(false))
    .addColumn('paymentMethodBrand', 'varchar(20)')
    .addColumn('paymentMethodLast4', 'varchar(4)')
    .addColumn('paymentMethodId', 'uuid', (col) =>
      col.references('payment_method.id').onDelete('set null'),
    )
    .execute()

  // payment
  await db.schema
    .createTable('payment')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorId', 'text', (col) => col.notNull())
    .addColumn('status', sql`payment_status`, (col) => col.notNull())
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('method', 'text', (col) => col.notNull())
    .addColumn('methodMetadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('customerId', 'uuid', (col) => col.references('customer.id'))
    .addColumn('customerEmail', 'varchar(320)')
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('checkoutSessionId', 'uuid', (col) =>
      col.references('checkout_session.id').onDelete('set null'),
    )
    .addColumn('paymentMethodId', 'uuid', (col) =>
      col.references('payment_method.id').onDelete('set null'),
    )
    .addColumn('declineReason', 'text')
    .addColumn('declineMessage', 'text')
    .addColumn('riskLevel', 'text')
    .addColumn('riskScore', 'smallint')
    .addColumn('processorMetadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('authorizedAt', 'timestamptz')
    .addColumn('capturedAt', 'timestamptz')
    .addColumn('canceledAt', 'timestamptz')
    .execute()

  // refund
  await db.schema
    .createTable('refund')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('reason', 'text')
    .addColumn('status', sql`refund_status`, (col) => col.notNull().defaultTo('succeeded'))
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorId', 'text')
    .addColumn('paymentId', 'uuid', (col) => col.references('payment.id'))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('customerId', 'uuid', (col) => col.references('customer.id'))
    .execute()

  // payout
  await db.schema
    .createTable('payout')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('accountId', 'uuid', (col) => col.references('connect_account.id'))
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('status', sql`payout_status`, (col) => col.notNull())
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorPayoutId', 'text')
    .addColumn('paidAt', 'timestamptz')
    .execute()

  // transaction
  await db.schema
    .createTable('transaction')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('type', sql`transaction_type`, (col) => col.notNull())
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('taxAmount', 'bigint', (col) => col.defaultTo(0))
    .addColumn('accountId', 'uuid', (col) => col.references('connect_account.id'))
    .addColumn('accountAmount', 'bigint')
    .addColumn('accountCurrency', 'varchar(3)')
    .addColumn('presentmentAmount', 'bigint')
    .addColumn('presentmentCurrency', 'varchar(3)')
    .addColumn('presentmentTaxAmount', 'bigint')
    .addColumn('taxFilingAmount', 'bigint')
    .addColumn('taxFilingCurrency', 'varchar(3)')
    .addColumn('taxCountry', 'varchar(2)')
    .addColumn('taxState', 'varchar(2)')
    .addColumn('processor', 'text', (col) => col.notNull())
    .addColumn('chargeId', 'text')
    .addColumn('transferId', 'text')
    .addColumn('refundId', 'uuid', (col) => col.references('refund.id'))
    .addColumn('payoutId', 'uuid', (col) => col.references('payout.id'))
    .addColumn('paymentTransactionId', 'uuid', (col) => col.references('transaction.id'))
    .addColumn('incurredByTransactionId', 'uuid', (col) => col.references('transaction.id'))
    .addColumn('payoutTransactionId', 'uuid', (col) => col.references('transaction.id'))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('customerId', 'uuid', (col) => col.references('customer.id'))
    .addColumn('productId', 'uuid', (col) => col.references('product.id'))
    .addColumn('productPriceId', 'uuid', (col) => col.references('product_price.id'))
    .addColumn('subscriptionId', 'uuid', (col) => col.references('subscription.id'))
    .addColumn('checkoutSessionId', 'uuid', (col) => col.references('checkout_session.id'))
    .addColumn('processorInvoiceId', 'text')
    .addColumn('paymentMethodBrand', 'varchar(20)')
    .addColumn('paymentMethodLast4', 'varchar(4)')
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'`))
    .addColumn('succeededAt', 'timestamptz')
    .addColumn('refundedAt', 'timestamptz')
    .addColumn('paymentId', 'uuid', (col) => col.references('payment.id'))
    .execute()

  // transfer
  await db.schema
    .createTable('transfer')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('processor', 'text', (col) => col.notNull())
    .addColumn('processorTransferId', 'text', (col) => col.notNull())
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('destinationAccountId', 'uuid', (col) =>
      col.notNull().references('connect_account.id'),
    )
    .addColumn('sourceTransactionId', 'uuid', (col) => col.references('transaction.id'))
    .addColumn('reversalId', 'text')
    .addColumn('reversedAt', 'timestamptz')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // held_balance
  await db.schema
    .createTable('held_balance')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('connectedAccountId', 'uuid', (col) => col.references('connect_account.id'))
    .addColumn('sourceTransactionId', 'uuid', (col) => col.references('transaction.id'))
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // processed_webhook_event
  await db.schema
    .createTable('processed_webhook_event')
    .ifNotExists()
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorEventId', 'text', (col) => col.notNull())
    .addColumn('eventType', 'text', (col) => col.notNull())
    .addColumn('processedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('apiVersion', 'text')
    .addColumn('data', 'jsonb')
    .addColumn('taskName', 'text')
    .addColumn('handledAt', 'timestamptz')
    .addColumn('requestId', 'text')
    .addPrimaryKeyConstraint('processed_webhook_event_pk', ['processor', 'processorEventId'])
    .execute()

  // dispute
  await db.schema
    .createTable('dispute')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('status', sql`dispute_status`, (col) => col.notNull())
    .addColumn('amount', 'bigint', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('processor', 'text', (col) => col.notNull().defaultTo('stripe'))
    .addColumn('processorId', 'text')
    .addColumn('reason', 'text')
    .addColumn('reasonMessage', 'text')
    .addColumn('paymentId', 'uuid', (col) => col.notNull().references('payment.id'))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('customerId', 'uuid', (col) => col.references('customer.id'))
    .addColumn('evidenceDueBy', 'timestamptz')
    .addColumn('evidenceSubmittedAt', 'timestamptz')
    .addColumn('resolvedAt', 'timestamptz')
    .execute()

  // feature
  await db.schema
    .createTable('feature')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('type', sql`feature_type`, (col) => col.notNull())
    .addColumn('meterType', sql`meter_type`)
    .addColumn('isCreditSystem', 'boolean', (col) => col.defaultTo(false))
    .addColumn('creditSchema', 'jsonb')
    .addColumn('config', 'jsonb', (col) => col.defaultTo(sql`'{}'`))
    .addColumn('display', 'jsonb')
    .addColumn('eventNames', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('isArchived', 'boolean', (col) => col.defaultTo(false))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // entitlement (product → feature link)
  await db.schema
    .createTable('entitlement')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('productId', 'uuid', (col) => col.references('product.id').onDelete('cascade'))
    .addColumn('featureId', 'uuid', (col) =>
      col.notNull().references('feature.id').onDelete('cascade'),
    )
    .addColumn('allowanceType', 'text')
    .addColumn('allowance', 'bigint')
    .addColumn('interval', 'text')
    .addColumn('intervalCount', 'integer', (col) => col.defaultTo(1))
    .addColumn('carryFromPrevious', 'boolean', (col) => col.defaultTo(false))
    .addColumn('rollover', 'jsonb')
    .addColumn('usageLimit', 'bigint')
    .addColumn('isCustom', 'boolean', (col) => col.defaultTo(false))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // customer_product (customer's active plans)
  await db.schema
    .createTable('customer_product')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('customerId', 'uuid', (col) =>
      col.notNull().references('customer.id').onDelete('cascade'),
    )
    .addColumn('productId', 'uuid', (col) => col.notNull().references('product.id'))
    .addColumn('subscriptionId', 'uuid', (col) => col.references('subscription.id'))
    .addColumn('status', 'text')
    .addColumn('processor', 'jsonb')
    .addColumn('canceled', 'boolean', (col) => col.defaultTo(false))
    .addColumn('canceledAt', 'timestamptz')
    .addColumn('endedAt', 'timestamptz')
    .addColumn('startsAt', 'timestamptz')
    .addColumn('trialEndsAt', 'timestamptz')
    .addColumn('collectionMethod', 'text', (col) => col.defaultTo('charge_automatically'))
    .addColumn('quantity', 'integer', (col) => col.defaultTo(1))
    .addColumn('isCustom', 'boolean', (col) => col.defaultTo(false))
    .addColumn('options', 'jsonb', (col) => col.defaultTo(sql`'[]'`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // customer_entitlement (customer's feature balances)
  await db.schema
    .createTable('customer_entitlement')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('customerProductId', 'uuid', (col) =>
      col.notNull().references('customer_product.id').onDelete('cascade'),
    )
    .addColumn('entitlementId', 'uuid', (col) =>
      col.notNull().references('entitlement.id').onDelete('cascade'),
    )
    .addColumn('customerId', 'uuid', (col) =>
      col.notNull().references('customer.id').onDelete('cascade'),
    )
    .addColumn('featureId', 'uuid', (col) =>
      col.notNull().references('feature.id').onDelete('cascade'),
    )
    .addColumn('unlimited', 'boolean', (col) => col.defaultTo(false))
    .addColumn('balance', 'bigint', (col) => col.defaultTo(0))
    .addColumn('usageAllowed', 'boolean', (col) => col.defaultTo(false))
    .addColumn('nextResetAt', 'timestamptz')
    .addColumn('additionalBalance', 'bigint', (col) => col.defaultTo(0))
    .addColumn('expiresAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // invoice
  await db.schema
    .createTable('invoice')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('customerId', 'uuid', (col) =>
      col.notNull().references('customer.id').onDelete('cascade'),
    )
    .addColumn('subscriptionId', 'uuid', (col) => col.references('subscription.id'))
    .addColumn('productIds', sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('stripeId', 'text', (col) => col.notNull().unique())
    .addColumn('status', sql`invoice_status`, (col) => col.defaultTo('draft'))
    .addColumn('hostedInvoiceUrl', 'text')
    .addColumn('total', 'bigint', (col) => col.defaultTo(0))
    .addColumn('currency', 'varchar(3)', (col) => col.defaultTo('usd'))
    .addColumn('discounts', 'jsonb', (col) => col.defaultTo(sql`'[]'`))
    .addColumn('items', 'jsonb', (col) => col.defaultTo(sql`'[]'`))
    .addColumn('periodStart', 'timestamptz')
    .addColumn('periodEnd', 'timestamptz')
    .addColumn('dueDate', 'timestamptz')
    .addColumn('paidAt', 'timestamptz')
    .addColumn('voidedAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Step 4: Add deferred FK for customer.defaultPaymentMethodId
  await db.schema
    .alterTable('customer')
    .addColumn('defaultPaymentMethodId', 'uuid', (col) =>
      col.references('payment_method.id').onDelete('set null'),
    )
    .execute()

  // Step 5: Add constraints and indexes

  // Unique constraints via raw SQL (complex constraints not easily expressed in Kysely)
  await sql`ALTER TABLE project ADD CONSTRAINT project_slug_key UNIQUE (slug)`.execute(db)
  await sql`ALTER TABLE customer ADD CONSTRAINT customer_project_id_email_key UNIQUE ("projectId", email)`.execute(
    db,
  )
  await sql`ALTER TABLE product ADD CONSTRAINT product_project_id_slug_key UNIQUE ("projectId", slug)`.execute(
    db,
  )
  await sql`ALTER TABLE customer ADD CONSTRAINT customer_project_id_external_id_key UNIQUE ("projectId", "externalId")`.execute(
    db,
  )
  await sql`ALTER TABLE checkout_session ADD CONSTRAINT checkout_session_processor_checkout_id_key UNIQUE (processor, "processorCheckoutId")`.execute(
    db,
  )
  await sql`ALTER TABLE payment_method ADD CONSTRAINT payment_method_processor_customer_key UNIQUE (processor, "processorId", "customerId")`.execute(
    db,
  )
  await sql`ALTER TABLE subscription ADD CONSTRAINT subscription_processor_subscription_id_key UNIQUE (processor, "processorSubscriptionId")`.execute(
    db,
  )
  await sql`ALTER TABLE payment ADD CONSTRAINT payment_processor_id_key UNIQUE (processor, "processorId")`.execute(
    db,
  )
  await sql`ALTER TABLE transfer ADD CONSTRAINT transfer_processor_transfer_id_key UNIQUE (processor, "processorTransferId")`.execute(
    db,
  )
  await sql`ALTER TABLE dispute ADD CONSTRAINT dispute_processor_id_key UNIQUE (processor, "processorId")`.execute(
    db,
  )
  await sql`ALTER TABLE connect_account ADD CONSTRAINT account_project_processor_key UNIQUE ("projectId", processor)`.execute(
    db,
  )
  await sql`CREATE UNIQUE INDEX ix_connect_account_processor_account_id ON connect_account (processor, "processorAccountId") WHERE "processorAccountId" IS NOT NULL`.execute(
    db,
  )
  await sql`CREATE UNIQUE INDEX ix_payout_processor_payout_id ON payout (processor, "processorPayoutId") WHERE "processorPayoutId" IS NOT NULL`.execute(
    db,
  )
  await sql`ALTER TABLE feature ADD CONSTRAINT feature_project_id_name_key UNIQUE ("projectId", name)`.execute(
    db,
  )
  await sql`CREATE UNIQUE INDEX ix_product_price_product_id_slug ON product_price("productId", slug) WHERE slug IS NOT NULL`.execute(
    db,
  )
  await sql`ALTER TABLE entitlement ADD CONSTRAINT entitlement_product_id_feature_id_key UNIQUE ("productId", "featureId")`.execute(
    db,
  )
  await sql`ALTER TABLE customer_entitlement ADD CONSTRAINT customer_entitlement_customer_id_feature_id_key UNIQUE ("customerId", "featureId")`.execute(
    db,
  )

  // Indexes
  await db.schema
    .createIndex('idx_product_project_id')
    .ifNotExists()
    .on('product')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_project_organization_id')
    .ifNotExists()
    .on('project')
    .column('organizationId')
    .execute()
  await db.schema
    .createIndex('idx_checkout_session_processor_checkout_id')
    .ifNotExists()
    .on('checkout_session')
    .column('processorCheckoutId')
    .execute()
  await db.schema
    .createIndex('idx_checkout_session_project_id')
    .ifNotExists()
    .on('checkout_session')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_transaction_project_id')
    .ifNotExists()
    .on('transaction')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_transaction_customer_id')
    .ifNotExists()
    .on('transaction')
    .column('customerId')
    .execute()
  await db.schema
    .createIndex('idx_transaction_charge_id')
    .ifNotExists()
    .on('transaction')
    .column('chargeId')
    .execute()
  await db.schema
    .createIndex('idx_subscription_processor_subscription_id')
    .ifNotExists()
    .on('subscription')
    .column('processorSubscriptionId')
    .execute()
  await db.schema
    .createIndex('idx_subscription_project_id')
    .ifNotExists()
    .on('subscription')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_processed_webhook_event_type')
    .ifNotExists()
    .on('processed_webhook_event')
    .column('eventType')
    .execute()
  await db.schema
    .createIndex('idx_connect_account_project')
    .ifNotExists()
    .on('connect_account')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_transfer_destination')
    .ifNotExists()
    .on('transfer')
    .column('destinationAccountId')
    .execute()
  await db.schema
    .createIndex('idx_connect_payout_account')
    .ifNotExists()
    .on('payout')
    .column('accountId')
    .execute()
  await db.schema
    .createIndex('idx_held_balance_project')
    .ifNotExists()
    .on('held_balance')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_held_balance_connected_account')
    .ifNotExists()
    .on('held_balance')
    .column('connectedAccountId')
    .execute()
  await db.schema
    .createIndex('ix_payment_method_customer_id')
    .ifNotExists()
    .on('payment_method')
    .column('customerId')
    .execute()
  await db.schema
    .createIndex('ix_payment_status')
    .ifNotExists()
    .on('payment')
    .column('status')
    .execute()
  await db.schema
    .createIndex('ix_payment_customer_id')
    .ifNotExists()
    .on('payment')
    .column('customerId')
    .execute()
  await db.schema
    .createIndex('ix_payment_project_id')
    .ifNotExists()
    .on('payment')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('ix_dispute_status')
    .ifNotExists()
    .on('dispute')
    .column('status')
    .execute()
  await db.schema
    .createIndex('ix_dispute_payment_id')
    .ifNotExists()
    .on('dispute')
    .column('paymentId')
    .execute()
  await db.schema
    .createIndex('ix_dispute_project_id')
    .ifNotExists()
    .on('dispute')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('ix_refund_status')
    .ifNotExists()
    .on('refund')
    .column('status')
    .execute()
  await db.schema
    .createIndex('ix_refund_payment_id')
    .ifNotExists()
    .on('refund')
    .column('paymentId')
    .execute()
  await db.schema
    .createIndex('ix_refund_project_id')
    .ifNotExists()
    .on('refund')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('ix_processed_webhook_event_handled_at')
    .ifNotExists()
    .on('processed_webhook_event')
    .column('handledAt')
    .execute()

  // API key index for auth lookups
  await sql`CREATE INDEX IF NOT EXISTS apikey_key_idx ON apikey (key)`.execute(db)

  // Billing layer indexes
  await db.schema
    .createIndex('idx_feature_project_id')
    .ifNotExists()
    .on('feature')
    .column('projectId')
    .execute()
  await db.schema
    .createIndex('idx_entitlement_product_id')
    .ifNotExists()
    .on('entitlement')
    .column('productId')
    .execute()
  await db.schema
    .createIndex('idx_entitlement_feature_id')
    .ifNotExists()
    .on('entitlement')
    .column('featureId')
    .execute()
  await db.schema
    .createIndex('idx_customer_product_customer_id')
    .ifNotExists()
    .on('customer_product')
    .column('customerId')
    .execute()
  await db.schema
    .createIndex('idx_customer_product_product_id')
    .ifNotExists()
    .on('customer_product')
    .column('productId')
    .execute()
  await db.schema
    .createIndex('idx_customer_entitlement_customer_product_id')
    .ifNotExists()
    .on('customer_entitlement')
    .column('customerProductId')
    .execute()
  await db.schema
    .createIndex('idx_customer_entitlement_customer_id')
    .ifNotExists()
    .on('customer_entitlement')
    .column('customerId')
    .execute()
  await db.schema
    .createIndex('idx_customer_entitlement_feature_id')
    .ifNotExists()
    .on('customer_entitlement')
    .column('featureId')
    .execute()
  await db.schema
    .createIndex('idx_invoice_customer_id')
    .ifNotExists()
    .on('invoice')
    .column('customerId')
    .execute()
  await db.schema
    .createIndex('idx_invoice_subscription_id')
    .ifNotExists()
    .on('invoice')
    .column('subscriptionId')
    .execute()
  await db.schema
    .createIndex('idx_invoice_status')
    .ifNotExists()
    .on('invoice')
    .column('status')
    .execute()

  // Expression index for OAuth callback performance
  await sql`CREATE INDEX idx_account_connect_state ON connect_account ((data->>'connect_state')) WHERE data->>'connect_state' IS NOT NULL`.execute(
    db,
  )

  // Partial unique index for refund.processorId
  await sql`CREATE UNIQUE INDEX ix_refund_processor_id ON refund("processorId") WHERE "processorId" IS NOT NULL`.execute(
    db,
  )

  // Partial unique index for transaction.processorInvoiceId (payment only)
  await sql`CREATE UNIQUE INDEX ix_transaction_processor_invoice_id ON "transaction"("processorInvoiceId") WHERE "processorInvoiceId" IS NOT NULL AND "type" = 'payment'`.execute(
    db,
  )

  // Partial unique index for transaction.chargeId (payment only) - prevents duplicates on webhook retries
  await sql`CREATE UNIQUE INDEX ix_transaction_charge_id_unique ON "transaction"("chargeId") WHERE "chargeId" IS NOT NULL AND "type" = 'payment'`.execute(
    db,
  )

  // Partial index for unprocessed webhooks
  await sql`CREATE INDEX ix_processed_webhook_event_unprocessed ON processed_webhook_event("processedAt") WHERE "handledAt" IS NULL`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop apikey index
  await sql`DROP INDEX IF EXISTS apikey_key_idx`.execute(db)

  // Drop billing layer indexes first
  await db.schema.dropIndex('ix_invoice_stripe_id').ifExists().execute()
  await db.schema.dropIndex('idx_invoice_status').ifExists().execute()
  await db.schema.dropIndex('idx_invoice_subscription_id').ifExists().execute()
  await db.schema.dropIndex('idx_invoice_customer_id').ifExists().execute()
  await db.schema.dropIndex('idx_customer_entitlement_feature_id').ifExists().execute()
  await db.schema.dropIndex('idx_customer_entitlement_customer_id').ifExists().execute()
  await db.schema.dropIndex('idx_customer_entitlement_customer_product_id').ifExists().execute()
  await db.schema.dropIndex('idx_customer_product_product_id').ifExists().execute()
  await db.schema.dropIndex('idx_customer_product_customer_id').ifExists().execute()
  await db.schema.dropIndex('idx_entitlement_feature_id').ifExists().execute()
  await db.schema.dropIndex('idx_entitlement_product_id').ifExists().execute()
  await db.schema.dropIndex('idx_feature_project_id').ifExists().execute()

  // Drop indexes (PostgreSQL automatically drops indexes when table is dropped, but we can be explicit)
  await db.schema.dropIndex('ix_processed_webhook_event_unprocessed').ifExists().execute()
  await db.schema.dropIndex('ix_payout_processor_payout_id').ifExists().execute()
  await db.schema.dropIndex('ix_product_price_product_id_slug').ifExists().execute()
  await db.schema.dropIndex('ix_connect_account_processor_account_id').ifExists().execute()
  await db.schema.dropIndex('ix_refund_processor_id').ifExists().execute()
  await db.schema.dropIndex('ix_transaction_processor_invoice_id').ifExists().execute()
  await db.schema.dropIndex('ix_transaction_charge_id_unique').ifExists().execute()
  await db.schema.dropIndex('idx_account_connect_state').ifExists().execute()
  await db.schema.dropIndex('ix_processed_webhook_event_handled_at').ifExists().execute()
  await db.schema.dropIndex('ix_dispute_project_id').ifExists().execute()
  await db.schema.dropIndex('ix_dispute_payment_id').ifExists().execute()
  await db.schema.dropIndex('ix_dispute_status').ifExists().execute()
  await db.schema.dropIndex('ix_payment_project_id').ifExists().execute()
  await db.schema.dropIndex('ix_payment_customer_id').ifExists().execute()
  await db.schema.dropIndex('ix_payment_status').ifExists().execute()
  await db.schema.dropIndex('ix_payment_method_customer_id').ifExists().execute()
  await db.schema.dropIndex('idx_held_balance_connected_account').ifExists().execute()
  await db.schema.dropIndex('idx_held_balance_project').ifExists().execute()
  await db.schema.dropIndex('idx_connect_payout_account').ifExists().execute()
  await db.schema.dropIndex('idx_transfer_destination').ifExists().execute()
  await db.schema.dropIndex('idx_connect_account_project').ifExists().execute()
  await db.schema.dropIndex('idx_processed_webhook_event_type').ifExists().execute()
  await db.schema.dropIndex('idx_subscription_project_id').ifExists().execute()
  await db.schema.dropIndex('idx_subscription_processor_subscription_id').ifExists().execute()
  await db.schema.dropIndex('idx_transaction_charge_id').ifExists().execute()
  await db.schema.dropIndex('idx_transaction_customer_id').ifExists().execute()
  await db.schema.dropIndex('idx_transaction_project_id').ifExists().execute()
  await db.schema.dropIndex('idx_checkout_session_project_id').ifExists().execute()
  await db.schema.dropIndex('ix_refund_project_id').ifExists().execute()
  await db.schema.dropIndex('idx_checkout_session_processor_checkout_id').ifExists().execute()
  await db.schema.dropIndex('idx_project_organization_id').ifExists().execute()
  await db.schema.dropIndex('idx_product_project_id').ifExists().execute()

  // Drop FK and columns from existing tables before dropping tables
  await db.schema.alterTable('customer').dropColumn('defaultPaymentMethodId').execute()

  // Drop billing layer unique constraints
  await sql`ALTER TABLE customer_entitlement DROP CONSTRAINT IF EXISTS customer_entitlement_customer_id_feature_id_key`.execute(
    db,
  )
  await sql`ALTER TABLE entitlement DROP CONSTRAINT IF EXISTS entitlement_product_id_feature_id_key`.execute(
    db,
  )
  await sql`ALTER TABLE feature DROP CONSTRAINT IF EXISTS feature_project_id_name_key`.execute(db)

  // Drop billing layer tables in reverse order of creation
  await db.schema.dropTable('invoice').ifExists().execute()
  await db.schema.dropTable('customer_entitlement').ifExists().execute()
  await db.schema.dropTable('customer_product').ifExists().execute()
  await db.schema.dropTable('entitlement').ifExists().execute()
  await db.schema.dropTable('feature').ifExists().execute()

  // Drop billing layer columns from product
  await db.schema.alterTable('product').dropColumn('env').execute()
  await db.schema.alterTable('product').dropColumn('planGroup').execute()
  await db.schema.alterTable('product').dropColumn('isAddOn').execute()

  // Drop tables in reverse order of creation (respecting FK dependencies)
  await db.schema.dropTable('dispute').ifExists().execute()
  await db.schema.dropTable('processed_webhook_event').ifExists().execute()
  await db.schema.dropTable('held_balance').ifExists().execute()
  await db.schema.dropTable('transfer').ifExists().execute()
  await db.schema.dropTable('transaction').ifExists().execute()
  await db.schema.dropTable('payout').ifExists().execute()
  await db.schema.dropTable('refund').ifExists().execute()
  await db.schema.dropTable('payment').ifExists().execute()
  await db.schema.dropTable('subscription').ifExists().execute()
  await db.schema.dropTable('payment_method').ifExists().execute()
  await db.schema.dropTable('checkout_session').ifExists().execute()
  await db.schema.dropTable('customer').ifExists().execute()
  await db.schema.dropTable('product_price').ifExists().execute()
  await db.schema.dropTable('product').ifExists().execute()
  await db.schema.dropTable('connect_account').ifExists().execute()

  // Drop unique constraints before dropping columns
  await sql`ALTER TABLE project DROP CONSTRAINT IF EXISTS project_slug_key`.execute(db)
  await sql`ALTER TABLE product DROP CONSTRAINT IF EXISTS product_project_id_slug_key`.execute(db)
  await sql`ALTER TABLE customer DROP CONSTRAINT IF EXISTS customer_project_id_external_id_key`.execute(
    db,
  )

  // Drop columns from existing tables
  await db.schema.alterTable('project').dropColumn('slug').execute()
  await db.schema.alterTable('organization').dropColumn('platformFeeFixed').execute()
  await db.schema.alterTable('organization').dropColumn('platformFeePercent').execute()
  await db.schema.alterTable('organization').dropColumn('createdBy').execute()

  // Drop enums
  await sql`DROP TYPE IF EXISTS invoice_status`.execute(db)
  await sql`DROP TYPE IF EXISTS meter_type`.execute(db)
  await sql`DROP TYPE IF EXISTS feature_type`.execute(db)
  await sql`DROP TYPE IF EXISTS refund_status`.execute(db)
  await sql`DROP TYPE IF EXISTS dispute_status`.execute(db)
  await sql`DROP TYPE IF EXISTS payment_status`.execute(db)
  await sql`DROP TYPE IF EXISTS transaction_type`.execute(db)
  await sql`DROP TYPE IF EXISTS recurring_interval`.execute(db)
  await sql`DROP TYPE IF EXISTS payout_status`.execute(db)
  await sql`DROP TYPE IF EXISTS subscription_status`.execute(db)
  await sql`DROP TYPE IF EXISTS checkout_mode`.execute(db)
  await sql`DROP TYPE IF EXISTS checkout_status`.execute(db)
}
