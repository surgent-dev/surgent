import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE project
    SET metadata = (
      metadata
      || CASE
        WHEN NOT metadata ? 'processName'
          AND jsonb_typeof(metadata #> '{provisioning,processName}') = 'string'
        THEN jsonb_build_object('processName', metadata #>> '{provisioning,processName}')
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN NOT metadata ? 'startCommand'
          AND jsonb_typeof(metadata #> '{provisioning,startCommand}') = 'string'
        THEN jsonb_build_object('startCommand', metadata #>> '{provisioning,startCommand}')
        ELSE '{}'::jsonb
      END
    )
      #- '{provisioning,clonedAt}'
      #- '{provisioning,processName}'
      #- '{provisioning,startCommand}'
    WHERE jsonb_typeof(metadata) = 'object'
      AND jsonb_typeof(metadata->'provisioning') = 'object'
  `.execute(db)
}

export async function down(): Promise<void> {
  throw new Error('042_redact_project_provisioning_metadata is irreversible')
}
