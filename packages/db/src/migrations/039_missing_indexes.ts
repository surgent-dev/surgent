import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // session.token — 80% of total DB runtime, 1.8M full-table-scans/day
  await sql`CREATE INDEX IF NOT EXISTS idx_session_token ON session (token)`.execute(db)

  // user.email — full scan on every email lookup
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user" (email)`.execute(db)

  // account(accountId, providerId) — full scan on every OAuth lookup
  await sql`CREATE INDEX IF NOT EXISTS idx_account_provider ON account ("accountId", "providerId")`.execute(
    db,
  )

  // pay_account(userId, env) — full scan on seller lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_pay_account_user_env ON pay_account ("userId", env)`.execute(
    db,
  )

  // billing_payment(kind, status) — full scan on payment aggregation
  await sql`CREATE INDEX IF NOT EXISTS idx_billing_payment_kind_status ON billing_payment (kind, status)`.execute(
    db,
  )

  // domain(status, updatedAt) — full scan on domain status checks
  await sql`CREATE INDEX IF NOT EXISTS idx_domain_status_updated ON domain (status, "updatedAt")`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_session_token`.execute(db)
  await sql`DROP INDEX IF EXISTS idx_user_email`.execute(db)
  await sql`DROP INDEX IF EXISTS idx_account_provider`.execute(db)
  await sql`DROP INDEX IF EXISTS idx_pay_account_user_env`.execute(db)
  await sql`DROP INDEX IF EXISTS idx_billing_payment_kind_status`.execute(db)
  await sql`DROP INDEX IF EXISTS idx_domain_status_updated`.execute(db)
}
