import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('worker_scriptName_unique')
    .ifNotExists()
    .on('worker')
    .column('scriptName')
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('worker_scriptName_unique').ifExists().execute()
}
