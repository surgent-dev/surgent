import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS trustmrr_startup (
      slug text PRIMARY KEY,
      name text NOT NULL,
      icon text,
      description text,
      website text,
      country text,
      "foundedDate" timestamptz,
      category text,
      "paymentProvider" text,
      "targetAudience" text,
      "revenueLast30Days" bigint NOT NULL DEFAULT 0,
      "revenueMrr" bigint NOT NULL DEFAULT 0,
      "revenueTotal" bigint NOT NULL DEFAULT 0,
      customers integer NOT NULL DEFAULT 0,
      "activeSubscriptions" integer NOT NULL DEFAULT 0,
      "askingPrice" bigint,
      "profitMarginLast30Days" numeric,
      "growth30d" numeric,
      multiple numeric,
      "onSale" boolean NOT NULL DEFAULT false,
      "firstListedForSaleAt" timestamptz,
      "xHandle" text,
      "syncedAt" timestamptz NOT NULL DEFAULT now(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db)

  await sql`CREATE INDEX idx_trustmrr_startup_category ON trustmrr_startup (category)`.execute(db)
  await sql`CREATE INDEX idx_trustmrr_startup_on_sale ON trustmrr_startup ("onSale")`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS trustmrr_startup`.execute(db)
}
