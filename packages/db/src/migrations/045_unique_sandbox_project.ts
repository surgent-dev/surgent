import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS "sandbox_projectId_idx"`.execute(db)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "sandbox_projectId_idx" ON sandbox ("projectId")`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS "sandbox_projectId_idx"`.execute(db)
  await sql`CREATE INDEX IF NOT EXISTS "sandbox_projectId_idx" ON sandbox ("projectId")`.execute(db)
}
