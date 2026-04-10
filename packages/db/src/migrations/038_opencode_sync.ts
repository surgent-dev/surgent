import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS opencode_sync_entity (
      "projectId"      uuid    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      "userId"         uuid    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "organizationId" uuid    NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      entity           text    NOT NULL,
      id               text    NOT NULL,
      "sessionId"      text,
      "messageId"      text,
      payload          jsonb   NOT NULL,
      "createdAt"      bigint  NOT NULL,
      "updatedAt"      bigint  NOT NULL,
      PRIMARY KEY ("projectId", entity, id)
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS opencode_sync_entity_session_idx
    ON opencode_sync_entity ("projectId", "sessionId")
    WHERE "sessionId" IS NOT NULL
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS opencode_sync_entity_message_idx
    ON opencode_sync_entity ("projectId", "messageId")
    WHERE "messageId" IS NOT NULL
  `.execute(db)

  await sql`
    CREATE TABLE IF NOT EXISTS opencode_sync_op (
      seq              bigserial PRIMARY KEY,
      "projectId"      uuid    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      "userId"         uuid    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "organizationId" uuid    NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      entity           text    NOT NULL,
      op               text    NOT NULL,
      "entityId"       text    NOT NULL,
      payload          jsonb,
      "createdAt"      bigint  NOT NULL
    )
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS opencode_sync_op_scope_idx
    ON opencode_sync_op ("projectId", seq)
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS opencode_sync_op`.execute(db)
  await sql`DROP TABLE IF EXISTS opencode_sync_entity`.execute(db)
}
