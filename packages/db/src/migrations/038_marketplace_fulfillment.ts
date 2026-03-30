import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('marketplace_snapshot')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('listingId', 'uuid', (col) =>
      col.notNull().references('listing.id').onDelete('cascade'),
    )
    .addColumn('projectId', 'uuid', (col) =>
      col.notNull().references('project.id').onDelete('cascade'),
    )
    .addColumn('storageKey', 'text', (col) => col.notNull())
    .addColumn('sizeBytes', 'bigint')
    .addColumn('checksum', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('marketplace_snapshot_listing_uq')
    .ifNotExists()
    .on('marketplace_snapshot')
    .column('listingId')
    .unique()
    .execute()

  await db.schema
    .createIndex('marketplace_snapshot_project_idx')
    .ifNotExists()
    .on('marketplace_snapshot')
    .column('projectId')
    .execute()

  await db.schema
    .createTable('marketplace_purchase')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('buyerId', 'uuid', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('listingId', 'uuid', (col) =>
      col.notNull().references('listing.id').onDelete('set null'),
    )
    .addColumn('sourceProjectId', 'uuid', (col) =>
      col.notNull().references('project.id').onDelete('set null'),
    )
    .addColumn('projectId', 'uuid', (col) => col.references('project.id').onDelete('set null'))
    .addColumn('checkoutSessionId', 'uuid', (col) =>
      col.references('pay_checkout_session.id').onDelete('set null'),
    )
    .addColumn('snapshotId', 'uuid', (col) =>
      col.references('marketplace_snapshot.id').onDelete('set null'),
    )
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('fulfillment', 'jsonb')
    .addColumn('error', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('fulfilledAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('marketplace_purchase_buyer_idx')
    .ifNotExists()
    .on('marketplace_purchase')
    .column('buyerId')
    .execute()

  await db.schema
    .createIndex('marketplace_purchase_checkout_uq')
    .ifNotExists()
    .on('marketplace_purchase')
    .column('checkoutSessionId')
    .unique()
    .execute()

  await db.schema
    .createTable('marketplace_env_rule')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('listingId', 'uuid', (col) =>
      col.notNull().references('listing.id').onDelete('cascade'),
    )
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('classification', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('marketplace_env_rule_listing_key_uq')
    .ifNotExists()
    .on('marketplace_env_rule')
    .columns(['listingId', 'key'])
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('marketplace_env_rule').ifExists().execute()
  await db.schema.dropTable('marketplace_purchase').ifExists().execute()
  await db.schema.dropTable('marketplace_snapshot').ifExists().execute()
}
