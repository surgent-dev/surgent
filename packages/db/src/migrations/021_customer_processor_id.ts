import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE pay_customer ADD COLUMN "processorCustomerId" TEXT`.execute(db)
  await sql`CREATE INDEX pay_customer_processor_id_idx ON pay_customer ("processorCustomerId")`.execute(
    db,
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS pay_customer_processor_id_idx`.execute(db)
  await sql`ALTER TABLE pay_customer DROP COLUMN IF EXISTS "processorCustomerId"`.execute(db)
}
