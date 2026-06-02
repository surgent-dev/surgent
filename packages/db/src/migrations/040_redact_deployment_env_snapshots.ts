import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE deployment
    SET "envSnapshot" = jsonb_build_object(
      'keys',
      COALESCE(
        (
          SELECT jsonb_agg(key ORDER BY key)
          FROM jsonb_object_keys(
            CASE
              WHEN jsonb_typeof("envSnapshot"->'vars') = 'object' THEN "envSnapshot"->'vars'
              ELSE '{}'::jsonb
            END
          ) AS env_key(key)
        ),
        (
          SELECT jsonb_agg(existing_key.value #>> '{}' ORDER BY existing_key.value #>> '{}')
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof("envSnapshot"->'keys') = 'array' THEN "envSnapshot"->'keys'
              ELSE '[]'::jsonb
            END
          ) AS existing_key(value)
          WHERE jsonb_typeof(existing_key.value) = 'string'
        ),
        '[]'::jsonb
      ),
      'capturedAt',
      CASE
        WHEN jsonb_typeof("envSnapshot"->'capturedAt') = 'string' THEN "envSnapshot"->'capturedAt'
        ELSE to_jsonb("createdAt")
      END
    )
    WHERE jsonb_typeof("envSnapshot") = 'object'
      AND "envSnapshot" ?| ARRAY['vars', 'keys']
  `.execute(db)

  await sql`
    UPDATE deployment
    SET error = CASE
      WHEN status = 'build_failed' THEN 'Build failed'
      ELSE 'Deployment failed'
    END
    WHERE error IS NOT NULL
  `.execute(db)
}

export async function down(): Promise<void> {
  throw new Error('040_redact_deployment_env_snapshots is irreversible')
}
