import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('apikey')
    .addColumn('projectId', 'uuid', (col) => col.references('project.id'))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('apikey').dropColumn('projectId').execute()
}
