import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('referral')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('referrerUserId', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('referredUserId', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('referral_referred_user_uq')
    .ifNotExists()
    .on('referral')
    .column('referredUserId')
    .unique()
    .execute()

  await db.schema
    .createIndex('referral_referrer_created_idx')
    .ifNotExists()
    .on('referral')
    .columns(['referrerUserId', 'createdAt'])
    .execute()

  await sql`
    ALTER TABLE referral
    ADD CONSTRAINT referral_no_self_referral_check
    CHECK ("referrerUserId" <> "referredUserId")
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('referral').ifExists().execute()
}
