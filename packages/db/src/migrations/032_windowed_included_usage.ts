import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE billing_subscription
    ADD COLUMN IF NOT EXISTS "includedUsageMicros" bigint NOT NULL DEFAULT 0
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    ADD COLUMN IF NOT EXISTS "includedUsagePeriodStart" timestamptz
  `.execute(db)

  await sql`
    ALTER TABLE billing_account
    DROP COLUMN IF EXISTS "includedBalanceMicros"
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    DROP COLUMN IF EXISTS "nextAllowanceGrantAt"
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE billing_account
    ADD COLUMN IF NOT EXISTS "includedBalanceMicros" bigint NOT NULL DEFAULT 0
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    ADD COLUMN IF NOT EXISTS "nextAllowanceGrantAt" timestamptz
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    DROP COLUMN IF EXISTS "includedUsagePeriodStart"
  `.execute(db)

  await sql`
    ALTER TABLE billing_subscription
    DROP COLUMN IF EXISTS "includedUsageMicros"
  `.execute(db)
}
