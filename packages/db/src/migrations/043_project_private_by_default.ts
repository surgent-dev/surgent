import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE project ALTER COLUMN "isPublic" SET DEFAULT false`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE project ALTER COLUMN "isPublic" SET DEFAULT true`.execute(db)
}
