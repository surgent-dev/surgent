import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE listing ADD COLUMN IF NOT EXISTS "productId" uuid REFERENCES product(id) ON DELETE SET NULL`.execute(
    db,
  )
  await sql`ALTER TABLE listing ADD COLUMN IF NOT EXISTS "priceId" uuid REFERENCES product_price(id) ON DELETE SET NULL`.execute(
    db,
  )
  await sql`CREATE INDEX IF NOT EXISTS listing_product_idx ON listing ("productId")`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS listing_product_idx`.execute(db)
  await sql`ALTER TABLE listing DROP COLUMN IF EXISTS "priceId"`.execute(db)
  await sql`ALTER TABLE listing DROP COLUMN IF EXISTS "productId"`.execute(db)
}
