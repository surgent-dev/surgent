import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('domain')
    .addColumn('dnsVerified', 'boolean', (col) => col.defaultTo(false).notNull())
    .execute()

  await db.schema
    .alterTable('domain')
    .addColumn('kvMapped', 'boolean', (col) => col.defaultTo(false).notNull())
    .execute()

  await db.schema.alterTable('domain').addColumn('lastError', 'text').execute()

  await db.schema
    .alterTable('domain')
    .addColumn('logs', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`).notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('domain').dropColumn('dnsVerified').execute()
  await db.schema.alterTable('domain').dropColumn('kvMapped').execute()
  await db.schema.alterTable('domain').dropColumn('lastError').execute()
  await db.schema.alterTable('domain').dropColumn('logs').execute()
}
