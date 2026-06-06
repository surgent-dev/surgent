import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE billing_subscription
    SET
      "monthlyAllowanceMicros" = 0,
      "updatedAt" = now()
    WHERE tier = 'free'
      AND "monthlyAllowanceMicros" <> 0
  `.execute(db)

  await sql`
    UPDATE billing_account AS account
    SET
      "includedBalanceMicros" = 0,
      "prepaidBalanceMicros" = 0,
      "includedBalancePeriodStart" = NULL,
      "updatedAt" = now()
    FROM billing_subscription AS subscription
    WHERE subscription."organizationId" = account."organizationId"
      AND subscription.tier = 'free'
      AND (
        account."includedBalanceMicros" <> 0
        OR account."prepaidBalanceMicros" <> 0
        OR account."includedBalancePeriodStart" IS NOT NULL
      )
  `.execute(db)
}

export async function down(_db: Kysely<any>): Promise<void> {
  // Intentionally do not recreate unpaid balances.
}
