import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE deployment ADD COLUMN IF NOT EXISTS "screenshotUrl" text`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE deployment DROP COLUMN IF EXISTS "screenshotUrl"`.execute(db)
}
