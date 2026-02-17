import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS pay_account_user_env_uq`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`CREATE UNIQUE INDEX pay_account_user_env_uq ON pay_account ("userId", env) WHERE status != 'disconnected'`.execute(
    db,
  )
}
