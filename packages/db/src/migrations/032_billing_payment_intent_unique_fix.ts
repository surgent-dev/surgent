import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('billing_payment_intent_uq')
    .ifNotExists()
    .on('billing_payment')
    .column('stripePaymentIntentId')
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('billing_payment_intent_uq').ifExists().execute()
}
