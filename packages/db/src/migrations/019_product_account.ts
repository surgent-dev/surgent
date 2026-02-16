import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Add accountId column to product table
  await sql`ALTER TABLE product ADD COLUMN IF NOT EXISTS "accountId" uuid REFERENCES pay_account(id) ON DELETE SET NULL`.execute(
    db,
  )

  // Create index on accountId
  await db.schema
    .createIndex('product_account_id_idx')
    .ifNotExists()
    .on('product')
    .columns(['accountId'])
    .execute()

  // Drop old unique indexes
  await sql`DROP INDEX IF EXISTS product_project_slug_env_uq`.execute(db)
  await sql`DROP INDEX IF EXISTS product_project_group_version_env_uq`.execute(db)

  // Create new unique indexes with accountId (COALESCE handles NULLs)
  await sql`CREATE UNIQUE INDEX product_project_slug_env_account_uq ON product ("projectId", slug, env, COALESCE("accountId", '00000000-0000-0000-0000-000000000000'::uuid))`.execute(
    db,
  )
  await sql`CREATE UNIQUE INDEX product_project_group_version_env_account_uq ON product ("projectId", "productGroup", version, env, COALESCE("accountId", '00000000-0000-0000-0000-000000000000'::uuid))`.execute(
    db,
  )

  // Backfill: set accountId from the most recent active pay_account for the same project+env
  await sql`
    UPDATE product
    SET "accountId" = (
      SELECT id FROM pay_account
      WHERE pay_account."projectId" = product."projectId"
        AND pay_account.env = product.env
        AND status != 'disconnected'
      ORDER BY "createdAt" DESC
      LIMIT 1
    )
    WHERE "accountId" IS NULL
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop new indexes
  await sql`DROP INDEX IF EXISTS product_project_slug_env_account_uq`.execute(db)
  await sql`DROP INDEX IF EXISTS product_project_group_version_env_account_uq`.execute(db)

  // Restore old unique indexes
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS product_project_slug_env_uq ON product ("projectId", slug, env)`.execute(
    db,
  )
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS product_project_group_version_env_uq ON product ("projectId", "productGroup", version, env)`.execute(
    db,
  )

  // Drop the accountId index and column
  await sql`DROP INDEX IF EXISTS product_account_id_idx`.execute(db)
  await sql`ALTER TABLE product DROP COLUMN IF EXISTS "accountId"`.execute(db)
}
