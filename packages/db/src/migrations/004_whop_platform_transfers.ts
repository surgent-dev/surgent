import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('merchants')
    .addColumn('id', 'text', (col) => col.primaryKey().references('user.id'))
    .addColumn('email', 'text')
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('whopCompanyId', 'text', (col) => col.unique())
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createTable('products')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('merchantId', 'text', (col) => col.notNull().references('merchants.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('description', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('draft'))
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('products_merchantId_idx').on('products').column('merchantId').execute()

  await db.schema
    .createTable('product_prices')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('productId', 'uuid', (col) => col.notNull().references('products.id'))
    .addColumn('code', 'text', (col) => col.notNull())
    .addColumn('amount', 'numeric', (col) => col.notNull())
    .addColumn('currency', 'text', (col) => col.notNull())
    .addColumn('active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('product_prices_productId_idx').on('product_prices').column('productId').execute()
  await db.schema.createIndex('product_prices_active_idx').on('product_prices').column('active').execute()

  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('merchantId', 'text', (col) => col.notNull().references('merchants.id'))
    .addColumn('customerId', 'text', (col) => col.notNull().references('user.id'))
    .addColumn('productId', 'uuid', (col) => col.notNull().references('products.id'))
    .addColumn('priceId', 'uuid', (col) => col.notNull().references('product_prices.id'))
    .addColumn('amount', 'numeric', (col) => col.notNull())
    .addColumn('currency', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('whopPaymentId', 'text', (col) => col.unique())
    .addColumn('whopPaymentStatus', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('orders_merchantId_idx').on('orders').column('merchantId').execute()
  await db.schema.createIndex('orders_customerId_idx').on('orders').column('customerId').execute()

  await db.schema
    .createTable('whop_transfers')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('orderId', 'uuid', (col) => col.notNull().unique().references('orders.id'))
    .addColumn('whopTransferId', 'text', (col) => col.unique())
    .addColumn('idempotencyKey', 'text', (col) => col.notNull().unique())
    .addColumn('originWhopCompanyId', 'text', (col) => col.notNull())
    .addColumn('destinationWhopCompanyId', 'text', (col) => col.notNull())
    .addColumn('amount', 'numeric', (col) => col.notNull())
    .addColumn('currency', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('raw', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('whop_transfers_destinationWhopCompanyId_idx')
    .on('whop_transfers')
    .column('destinationWhopCompanyId')
    .execute()

  await db.schema
    .createTable('whop_webhook_events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('webhookId', 'text', (col) => col.notNull().unique())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('whopCompanyId', 'text')
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('receivedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('processedAt', 'timestamptz')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('error', 'text')
    .execute()

  await db.schema.createIndex('whop_webhook_events_type_idx').on('whop_webhook_events').column('type').execute()
  await db.schema
    .createIndex('whop_webhook_events_status_idx')
    .on('whop_webhook_events')
    .column('status')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('whop_webhook_events').execute()
  await db.schema.dropTable('whop_transfers').execute()
  await db.schema.dropTable('orders').execute()
  await db.schema.dropTable('product_prices').execute()
  await db.schema.dropTable('products').execute()
  await db.schema.dropTable('merchants').execute()
}
