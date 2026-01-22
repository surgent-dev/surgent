import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('usage')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('model', 'text', (col) => col.notNull())
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('inputTokens', 'integer', (col) => col.notNull())
    .addColumn('outputTokens', 'integer', (col) => col.notNull())
    .addColumn('reasoningTokens', 'integer')
    .addColumn('cacheReadTokens', 'integer')
    .addColumn('cacheWrite5mTokens', 'integer')
    .addColumn('cacheWrite1hTokens', 'integer')
    .addColumn('cost', 'bigint', (col) => col.notNull())
    .addColumn('keyId', 'text', (col) => col.references('apikey.id'))
    .addColumn('enrichment', 'jsonb')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('usage_project_created_idx')
    .ifNotExists()
    .on('usage')
    .columns(['projectId', 'createdAt'])
    .execute()

  await db.schema
    .createTable('provider')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('credentials', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('provider_project_provider_uq')
    .ifNotExists()
    .on('provider')
    .columns(['projectId', 'provider'])
    .unique()
    .execute()

  await db.schema
    .createTable('model')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id'))
    .addColumn('model', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('model_project_model_uq')
    .ifNotExists()
    .on('model')
    .columns(['projectId', 'model'])
    .unique()
    .execute()

  await db.schema
    .createTable('ip')
    .ifNotExists()
    .addColumn('ip', 'text', (col) => col.primaryKey())
    .addColumn('usage', 'integer')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deletedAt', 'timestamptz')
    .execute()

  await db.schema
    .createTable('ip_rate_limit')
    .ifNotExists()
    .addColumn('ip', 'text', (col) => col.notNull())
    .addColumn('interval', 'text', (col) => col.notNull())
    .addColumn('count', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('ip_rate_limit_pk', ['ip', 'interval'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ip_rate_limit').ifExists().execute()
  await db.schema.dropTable('ip').ifExists().execute()
  await db.schema.dropTable('model').ifExists().execute()
  await db.schema.dropTable('provider').ifExists().execute()
  await db.schema.dropTable('usage').ifExists().execute()
}
