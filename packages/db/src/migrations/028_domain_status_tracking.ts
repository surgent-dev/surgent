import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "dnsVerified" boolean NOT NULL DEFAULT false`.execute(
    db,
  )
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "kvMapped" boolean NOT NULL DEFAULT false`.execute(
    db,
  )
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "lastError" text`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS logs jsonb NOT NULL DEFAULT '[]'::jsonb`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('domain').dropColumn('dnsVerified').execute()
  await db.schema.alterTable('domain').dropColumn('kvMapped').execute()
  await db.schema.alterTable('domain').dropColumn('lastError').execute()
  await db.schema.alterTable('domain').dropColumn('logs').execute()
}
