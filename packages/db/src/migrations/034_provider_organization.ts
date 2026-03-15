import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE provider ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES organization(id)`.execute(
    db,
  )

  // Backfill organizationId from project
  await sql`
    UPDATE provider SET "organizationId" = p."organizationId"
    FROM project p WHERE provider."projectId" = p.id AND provider."organizationId" IS NULL
  `.execute(db)

  // Make projectId nullable
  await sql`ALTER TABLE provider ALTER COLUMN "projectId" DROP NOT NULL`.execute(db)

  // Make organizationId NOT NULL after backfill
  await sql`ALTER TABLE provider ALTER COLUMN "organizationId" SET NOT NULL`.execute(db)

  // Drop old unique index and create new one
  await db.schema.dropIndex('provider_project_provider_uq').ifExists().execute()
  await db.schema
    .createIndex('provider_organization_provider_uq')
    .ifNotExists()
    .on('provider')
    .columns(['organizationId', 'provider'])
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('provider_organization_provider_uq').ifExists().execute()
  await db.schema
    .createIndex('provider_project_provider_uq')
    .ifNotExists()
    .on('provider')
    .columns(['projectId', 'provider'])
    .unique()
    .execute()
  await sql`ALTER TABLE provider ALTER COLUMN "projectId" SET NOT NULL`.execute(db)
  await sql`ALTER TABLE provider DROP COLUMN IF EXISTS "organizationId"`.execute(db)
}
