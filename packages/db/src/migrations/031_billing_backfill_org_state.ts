import { type Kysely, sql } from 'kysely'

const FREE_MONTHLY_ALLOWANCE_MICROS = 300000000

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    INSERT INTO billing_account (
      id,
      "organizationId",
      "stripeCustomerId",
      "defaultPaymentMethodId",
      "paymentMethodBrand",
      "paymentMethodLast4",
      "includedBalanceMicros",
      "prepaidBalanceMicros",
      "autoReloadEnabled",
      "autoReloadThresholdMicros",
      "autoReloadAmountMicros",
      "monthlySpendLimitMicros",
      currency,
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      o.id,
      o."stripeCustomerId",
      NULL,
      NULL,
      NULL,
      0,
      0,
      false,
      NULL,
      NULL,
      NULL,
      'usd',
      now(),
      now()
    FROM organization o
    LEFT JOIN billing_account ba ON ba."organizationId" = o.id
    WHERE ba.id IS NULL
  `.execute(db)

  await sql`
    INSERT INTO billing_subscription (
      id,
      "organizationId",
      "stripeSubscriptionId",
      "stripePriceId",
      tier,
      interval,
      status,
      "trialStart",
      "trialEnd",
      "currentPeriodStart",
      "currentPeriodEnd",
      "cancelAtPeriodEnd",
      "canceledAt",
      "monthlyAllowanceMicros",
      "nextAllowanceGrantAt",
      "stripeCouponId",
      "stripeDiscountId",
      "stripePromotionCodeId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      o.id,
      NULL,
      NULL,
      'free',
      NULL,
      'free',
      NULL,
      NULL,
      date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
      (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC',
      false,
      NULL,
      ${String(FREE_MONTHLY_ALLOWANCE_MICROS)}::bigint,
      (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC',
      NULL,
      NULL,
      NULL,
      now(),
      now()
    FROM organization o
    LEFT JOIN billing_subscription bs ON bs."organizationId" = o.id
    WHERE bs.id IS NULL
  `.execute(db)
}

export async function down(_: Kysely<any>): Promise<void> {}
