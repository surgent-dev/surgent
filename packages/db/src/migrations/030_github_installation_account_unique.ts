import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('github_installations_user_account_unique')
    .ifNotExists()
    .on('github_installations')
    .columns(['userId', 'accountLogin'])
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('github_installations_user_account_unique').ifExists().execute()
}
