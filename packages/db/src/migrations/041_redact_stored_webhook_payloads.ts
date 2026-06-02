import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE billing_event
    SET payload = jsonb_build_object(
      'eventId', "stripeEventId",
      'eventType', type,
      'redactedAt', to_jsonb(now())
    )
  `.execute(db)

  await sql`
    UPDATE pay_webhook_event
    SET payload = jsonb_build_object(
      'eventId', id,
      'eventType', "eventType",
      'env', env,
      'redactedAt', to_jsonb(now())
    )
  `.execute(db)

  for (const table of [
    'pay_payment',
    'pay_subscription',
    'pay_invoice',
    'pay_refund',
    'pay_dispute',
    'pay_transaction',
  ]) {
    await sql.raw(`UPDATE ${table} SET raw = '{}'::jsonb`).execute(db)
  }

  await sql`
    UPDATE pay_payment
    SET
      "customerEmail" = NULL,
      "customerName" = NULL,
      "cardBrand" = NULL,
      "cardLast4" = NULL,
      "failureMessage" = NULL
  `.execute(db)

  await sql`
    UPDATE pay_account
    SET metadata = metadata - 'verification' - 'email'
    WHERE jsonb_typeof(metadata) = 'object'
      AND metadata ?| ARRAY['verification', 'email']
  `.execute(db)

  await sql`
    UPDATE pay_checkout_session
    SET metadata = metadata - 'customer_email' - 'customer_name'
    WHERE jsonb_typeof(metadata) = 'object'
      AND metadata ?| ARRAY['customer_email', 'customer_name']
  `.execute(db)

  await sql`
    UPDATE domain_webhook_event
    SET payload = jsonb_build_object(
      'eventId', "entriEventId",
      'eventType', "eventType",
      'domainName', "domainName",
      'redactedAt', to_jsonb(now())
    )
  `.execute(db)
}

export async function down(): Promise<void> {
  throw new Error('041_redact_stored_webhook_payloads is irreversible')
}
