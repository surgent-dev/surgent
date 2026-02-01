import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Add userId column to connect_account for reconnection lookup
  await db.schema
    .alterTable('connect_account')
    .addColumn('userId', 'uuid', (col) => col.references('user.id'))
    .execute()

  // Index for finding disconnected accounts by user + processor
  await db.schema
    .createIndex('idx_connect_account_user_processor')
    .on('connect_account')
    .columns(['userId', 'processor'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_connect_account_user_processor').ifExists().execute()
  await db.schema.alterTable('connect_account').dropColumn('userId').execute()
}
