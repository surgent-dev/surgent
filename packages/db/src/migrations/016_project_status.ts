import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('project')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('provisioning'))
    .addColumn('failReason', 'text')
    .execute()

  // Backfill existing projects as ready (they already completed initialization)
  await sql`UPDATE project SET status = 'ready' WHERE "deletedAt" IS NULL`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('project').dropColumn('failReason').dropColumn('status').execute()
}
