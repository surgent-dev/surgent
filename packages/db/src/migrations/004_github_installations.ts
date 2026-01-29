import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('github_installations')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('installationId', 'bigint', (col) => col.notNull().unique())
    .addColumn('accountLogin', 'text', (col) => col.notNull())
    .addColumn('accountType', 'text', (col) => col.notNull())
    .addColumn('userAccessToken', 'text')
    .addColumn('userAccessTokenExpiresAt', 'timestamptz')
    .addColumn('userRefreshToken', 'text')
    .addColumn('userRefreshTokenExpiresAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('github_installations_userId_idx')
    .ifNotExists()
    .on('github_installations')
    .column('userId')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('github_installations').execute()
}
