import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE domain RENAME COLUMN "kvMapped" TO "routingConfigured"`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE domain RENAME COLUMN "routingConfigured" TO "kvMapped"`.execute(db)
}
