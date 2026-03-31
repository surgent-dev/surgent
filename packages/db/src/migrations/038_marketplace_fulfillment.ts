import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // -- marketplace_snapshot: immutable R2 archive per listing version --
  await db.schema
    .createTable('marketplace_snapshot')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) =>
      col.notNull().references('project.id').onDelete('cascade'),
    )
    .addColumn('storageKey', 'text', (col) => col.notNull())
    .addColumn('sizeBytes', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('marketplace_snapshot_project_version_idx')
    .ifNotExists()
    .on('marketplace_snapshot')
    .columns(['projectId', 'version'])
    .execute()

  // -- marketplace_purchase: fulfillment state machine per buyer --
  await db.schema
    .createTable('marketplace_purchase')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('listingId', 'uuid', (col) => col.notNull().references('listing.id'))
    .addColumn('snapshotId', 'uuid', (col) => col.notNull().references('marketplace_snapshot.id'))
    .addColumn('buyerUserId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('buyerOrgId', 'uuid', (col) => col.notNull().references('organization.id'))
    .addColumn('sellerProjectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('buyerProjectId', 'uuid', (col) => col.references('project.id'))
    .addColumn('checkoutId', 'uuid', (col) => col.references('pay_checkout_session.id'))
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('step', 'text')
    .addColumn('failReason', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Unique checkout prevents duplicate fulfillment for paid listings
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS marketplace_purchase_checkout_uq
    ON marketplace_purchase ("checkoutId")
    WHERE "checkoutId" IS NOT NULL
  `.execute(db)

  await db.schema
    .createIndex('marketplace_purchase_buyer_idx')
    .ifNotExists()
    .on('marketplace_purchase')
    .column('buyerUserId')
    .execute()

  await sql`
    CREATE INDEX IF NOT EXISTS marketplace_purchase_buyer_project_idx
    ON marketplace_purchase ("buyerProjectId")
    WHERE "buyerProjectId" IS NOT NULL
  `.execute(db)

  // -- Add snapshotId to listing --
  await sql`
    ALTER TABLE listing ADD COLUMN IF NOT EXISTS "snapshotId" uuid
    REFERENCES marketplace_snapshot(id) ON DELETE SET NULL
  `.execute(db)

  // -- Add sourceProjectId and purchaseId to project --
  await sql`
    ALTER TABLE project ADD COLUMN IF NOT EXISTS "sourceProjectId" uuid
    REFERENCES project(id) ON DELETE SET NULL
  `.execute(db)

  await sql`
    ALTER TABLE project ADD COLUMN IF NOT EXISTS "purchaseId" uuid
    REFERENCES marketplace_purchase(id) ON DELETE SET NULL
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE project DROP COLUMN IF EXISTS "purchaseId"`.execute(db)
  await sql`ALTER TABLE project DROP COLUMN IF EXISTS "sourceProjectId"`.execute(db)
  await sql`ALTER TABLE listing DROP COLUMN IF EXISTS "snapshotId"`.execute(db)
  await db.schema.dropTable('marketplace_purchase').ifExists().execute()
  await db.schema.dropTable('marketplace_snapshot').ifExists().execute()
}
