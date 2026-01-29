import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('apikey')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text')
    .addColumn('start', 'text')
    .addColumn('prefix', 'text')
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('organizationId', 'uuid', (col) => col.references('organization.id'))
    .addColumn('projectId', 'uuid', (col) => col.references('project.id'))
    .addColumn('refillInterval', 'integer')
    .addColumn('refillAmount', 'integer')
    .addColumn('lastRefillAt', 'timestamptz')
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('rateLimitEnabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('rateLimitTimeWindow', 'integer')
    .addColumn('rateLimitMax', 'integer')
    .addColumn('requestCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('remaining', 'integer')
    .addColumn('lastRequest', 'timestamptz')
    .addColumn('expiresAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .addColumn('permissions', 'text')
    .addColumn('metadata', 'jsonb')
    .execute()

  await db.schema
    .createIndex('apikey_projectId_idx')
    .ifNotExists()
    .on('apikey')
    .column('projectId')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('apikey').execute()
}
