import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('domain')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.references('project.id').onDelete('set null'))
    .addColumn('userId', 'uuid', (col) => col.references('user.id').onDelete('cascade').notNull())
    .addColumn('organizationId', 'uuid')
    .addColumn('domainName', 'varchar(255)', (col) => col.notNull())
    .addColumn('status', 'varchar(30)', (col) => col.notNull().defaultTo('pending'))
    .addColumn('registrar', 'varchar(100)')
    .addColumn('entriFlowId', 'varchar(255)')
    .addColumn('cfCustomDomainId', 'varchar(255)')
    .addColumn('purchasedAt', 'timestamptz')
    .addColumn('expiresAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .execute()

  await db.schema.createIndex('domain_project_id_idx').on('domain').column('projectId').execute()

  await db.schema.createIndex('domain_user_id_idx').on('domain').column('userId').execute()

  await db.schema
    .createIndex('domain_domain_name_unique')
    .on('domain')
    .column('domainName')
    .unique()
    .execute()

  await db.schema
    .createTable('domain_webhook_event')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('entriEventId', 'varchar(255)')
    .addColumn('eventType', 'varchar(100)', (col) => col.notNull())
    .addColumn('domainName', 'varchar(255)')
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('pending'))
    .addColumn('error', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('processedAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('domain_webhook_event_status_idx')
    .on('domain_webhook_event')
    .columns(['status', 'createdAt'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('domain_webhook_event').ifExists().execute()
  await db.schema.dropTable('domain').ifExists().execute()
}
