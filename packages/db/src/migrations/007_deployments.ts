import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('project').addColumn('deletedAt', 'timestamptz').execute()

  // workers - prod runtime state
  await db.schema
    .createTable('worker')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('accountId', 'text', (col) => col.notNull())
    .addColumn('scriptName', 'text', (col) => col.notNull())
    .addColumn('dispatchNamespace', 'text')
    .addColumn('hostname', 'text')
    .addColumn('status', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('worker_projectId_idx').ifNotExists().on('worker').column('projectId').execute()

  // sandboxes - dev runtime state
  await db.schema
    .createTable('sandbox')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('host', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('sandbox_projectId_idx').ifNotExists().on('sandbox').column('projectId').execute()

  // integrations - connected services (Convex, Supabase, etc.)
  await db.schema
    .createTable('integration')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('config', 'jsonb')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo(sql`'connected'`))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('integration_projectId_provider_idx')
    .ifNotExists()
    .on('integration')
    .columns(['projectId', 'provider'])
    .unique()
    .execute()

  // env_vars - all env keys + values per environment
  await db.schema
    .createTable('env_var')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('environment', 'text', (col) => col.notNull())
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('value', 'text')
    .addColumn('integrationId', 'uuid', (col) => col.references('integration.id').onDelete('set null'))
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('env_var_projectId_env_key_idx')
    .ifNotExists()
    .on('env_var')
    .columns(['projectId', 'environment', 'key'])
    .unique()
    .execute()

  // deployments - deploy history with rollback
  await db.schema
    .createTable('deployment')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('scriptName', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('startedAt', 'timestamptz')
    .addColumn('finishedAt', 'timestamptz')
    .addColumn('cloudflareDeploymentId', 'text')
    .addColumn('cloudflareVersionId', 'text')
    .addColumn('rollbackOf', 'uuid', (col) => col.references('deployment.id'))
    .addColumn('hostname', 'text')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex('deployment_projectId_idx').ifNotExists().on('deployment').column('projectId').execute()

  // drop old table
  await db.schema.dropTable('deployment_history').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // drop in reverse order (respecting FK)
  await db.schema.dropTable('deployment').ifExists().execute()
  await db.schema.dropTable('env_var').ifExists().execute()
  await db.schema.dropTable('integration').ifExists().execute()
  await db.schema.dropTable('sandbox').ifExists().execute()
  await db.schema.dropTable('worker').ifExists().execute()
  await db.schema.alterTable('project').dropColumn('deletedAt').execute()

  // restore old table
  await db.schema
    .createTable('deployment_history')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('projectId', 'uuid', (col) => col.notNull().references('project.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('previewUrl', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('startedAt', 'timestamp', (col) => col.notNull())
    .addColumn('deployedAt', 'timestamp')
    .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('deployment_history_projectId_idx')
    .ifNotExists()
    .on('deployment_history')
    .column('projectId')
    .execute()
}
