import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Create surpay_organizations table
  await db.schema
    .createTable('surpay_organizations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('userId', 'text', (col) => col.notNull().unique().references('user.id').onDelete('cascade'))
    .addColumn('surpayOrgId', 'uuid', (col) => col.notNull())
    .addColumn('apiKey', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Add surpayProjectId column to project table
  await db.schema.alterTable('project').addColumn('surpayProjectId', 'uuid').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('project').dropColumn('surpayProjectId').execute()

  await db.schema.dropTable('surpay_organizations').execute()
}
