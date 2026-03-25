import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "isPrimary" boolean NOT NULL DEFAULT true`.execute(
    db,
  )
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "redirectTarget" varchar(255)`.execute(db)

  await sql`UPDATE domain SET "isPrimary" = true WHERE status = 'active'`.execute(db)

  // Partial unique index: only one primary per project
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS domain_project_primary_unique
    ON domain ("projectId")
    WHERE "isPrimary" = true AND status IN ('active', 'ssl_provisioning', 'purchasing', 'dns_configuring')
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS domain_project_primary_unique`.execute(db)
  await db.schema.alterTable('domain').dropColumn('isPrimary').execute()
  await db.schema.alterTable('domain').dropColumn('redirectTarget').execute()
}
