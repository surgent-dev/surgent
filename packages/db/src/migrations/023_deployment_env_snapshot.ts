import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE deployment ADD COLUMN IF NOT EXISTS "envSnapshot" jsonb`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE deployment DROP COLUMN IF EXISTS "envSnapshot"`.execute(db)
}
