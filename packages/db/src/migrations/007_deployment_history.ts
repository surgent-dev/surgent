import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('deployment_history')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('previewUrl', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('startedAt', 'timestamp', (col) => col.notNull())
    .addColumn('deployedAt', 'timestamp')
    .addColumn('versionId', 'text')
    .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('deployment_history_projectId_idx').on('deployment_history').column('projectId').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('deployment_history').execute()
}
