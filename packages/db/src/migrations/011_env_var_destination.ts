import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('env_var')
    .addColumn('destination', 'text') // 'server' | 'client' | 'both'
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('env_var').dropColumn('destination').execute()
}
