import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Deduplicate: for each (userId, env), keep newest non-disconnected row, disconnect the rest
  await sql`
    UPDATE pay_account SET status = 'disconnected'
    WHERE id NOT IN (
      SELECT DISTINCT ON ("userId", env) id
      FROM pay_account
      WHERE status != 'disconnected'
      ORDER BY "userId", env, "createdAt" DESC
    )
    AND status != 'disconnected'
  `.execute(db)

  // 2. Drop old unique constraint and index
  await sql`DROP INDEX IF EXISTS pay_account_project_user_env_uq`.execute(db)
  await sql`DROP INDEX IF EXISTS pay_account_project_env_idx`.execute(db)

  // 3. Make projectId nullable
  await sql`ALTER TABLE pay_account ALTER COLUMN "projectId" DROP NOT NULL`.execute(db)

  // 4. Clear projectId on all rows (accounts are user-scoped now)
  await sql`UPDATE pay_account SET "projectId" = NULL`.execute(db)

  // 5. Create new unique constraint on (userId, env) — one account per user per env
  await sql`CREATE UNIQUE INDEX pay_account_user_env_uq ON pay_account ("userId", env) WHERE status != 'disconnected'`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS pay_account_user_env_uq`.execute(db)
  await sql`ALTER TABLE pay_account ALTER COLUMN "projectId" SET NOT NULL`.execute(db)
  await sql`CREATE UNIQUE INDEX pay_account_project_user_env_uq ON pay_account ("projectId", "userId", env)`.execute(
    db,
  )
  await sql`CREATE INDEX pay_account_project_env_idx ON pay_account ("projectId", env)`.execute(db)
}
