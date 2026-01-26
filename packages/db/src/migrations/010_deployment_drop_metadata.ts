import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('deployment').dropColumn('metadata').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('deployment').addColumn('metadata', 'jsonb').execute()
}
