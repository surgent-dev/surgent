import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Make projectId nullable on connect_account to support "disconnected" accounts
  // Disconnected accounts preserve payment history but are not linked to any project
  await db.schema
    .alterTable('connect_account')
    .alterColumn('projectId', (col) => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // First, delete any disconnected accounts (projectId IS NULL) to satisfy NOT NULL constraint
  await sql`DELETE FROM connect_account WHERE "projectId" IS NULL`.execute(db)

  // Restore NOT NULL constraint
  await db.schema
    .alterTable('connect_account')
    .alterColumn('projectId', (col) => col.setNotNull())
    .execute()
}
