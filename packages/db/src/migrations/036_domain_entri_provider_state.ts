import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "propagationStatus" varchar(32)`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "secureStatus" varchar(32)`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "powerStatus" varchar(32)`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "cnameTarget" varchar(255)`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "freeDomain" boolean NOT NULL DEFAULT false`.execute(
    db,
  )
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "lastWebhookAt" timestamptz`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "sslMeta" jsonb`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "isPrimary" boolean NOT NULL DEFAULT false`.execute(
    db,
  )

  await sql`
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY "projectId"
          ORDER BY
            CASE status
              WHEN 'active' THEN 0
              WHEN 'ssl_provisioning' THEN 1
              WHEN 'dns_configuring' THEN 2
              WHEN 'purchasing' THEN 3
              ELSE 4
            END,
            "createdAt" ASC,
            id ASC
        ) AS rank
      FROM domain
      WHERE "projectId" IS NOT NULL
        AND status IN ('active', 'ssl_provisioning', 'purchasing', 'dns_configuring')
    )
    UPDATE domain
    SET "isPrimary" = CASE WHEN ranked.rank = 1 THEN true ELSE false END
    FROM ranked
    WHERE domain.id = ranked.id
  `.execute(db)

  await sql`
    WITH duplicate_events AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY "entriEventId"
          ORDER BY "createdAt" DESC, id DESC
        ) AS rank
      FROM domain_webhook_event
      WHERE "entriEventId" IS NOT NULL
    )
    DELETE FROM domain_webhook_event
    WHERE id IN (
      SELECT id
      FROM duplicate_events
      WHERE rank > 1
    )
  `.execute(db)

  await sql`
    DROP INDEX IF EXISTS domain_project_primary_unique
  `.execute(db)

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS domain_project_primary_unique
    ON domain ("projectId")
    WHERE "isPrimary" = true AND status IN ('active', 'ssl_provisioning', 'purchasing', 'dns_configuring')
  `.execute(db)

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS domain_webhook_event_entri_event_id_unique
    ON domain_webhook_event ("entriEventId")
    WHERE "entriEventId" IS NOT NULL
  `.execute(db)

  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "cfCustomDomainId"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "dnsVerified"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "kvMapped"`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS domain_webhook_event_entri_event_id_unique`.execute(db)
  await sql`DROP INDEX IF EXISTS domain_project_primary_unique`.execute(db)

  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "cfCustomDomainId" varchar(255)`.execute(db)
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "dnsVerified" boolean NOT NULL DEFAULT false`.execute(
    db,
  )
  await sql`ALTER TABLE domain ADD COLUMN IF NOT EXISTS "kvMapped" boolean NOT NULL DEFAULT false`.execute(
    db,
  )

  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "propagationStatus"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "secureStatus"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "powerStatus"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "cnameTarget"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "freeDomain"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "lastWebhookAt"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "sslMeta"`.execute(db)
  await sql`ALTER TABLE domain DROP COLUMN IF EXISTS "isPrimary"`.execute(db)
}
