import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "sslMeta" jsonb`.execute(db)

  // Migrate existing SSL metadata from lastError to sslMeta
  await sql`
    UPDATE domain
    SET "sslMeta" = "lastError"::jsonb,
        "lastError" = NULL
    WHERE "lastError" IS NOT NULL
      AND "lastError" LIKE '%ssl_provisioning_meta%'
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE domain
    SET "lastError" = "sslMeta"::text
    WHERE "sslMeta" IS NOT NULL
      AND "lastError" IS NULL
  `.execute(db)

  await db.schema.alterTable('domain').dropColumn('sslMeta').execute()
}
