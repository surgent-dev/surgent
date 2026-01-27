import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('github_oauth_tokens')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('userId', 'uuid', (col) => col.notNull().references('user.id').unique())
    .addColumn('accessToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamp')
    .addColumn('refreshToken', 'text')
    .addColumn('refreshTokenExpiresAt', 'timestamp')
    .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'github_installations'
          AND column_name = 'userAccessToken'
      ) THEN
        INSERT INTO github_oauth_tokens (
          "userId",
          "accessToken",
          "accessTokenExpiresAt",
          "refreshToken",
          "refreshTokenExpiresAt",
          "createdAt",
          "updatedAt"
        )
        SELECT DISTINCT ON ("userId")
          "userId",
          "userAccessToken",
          "userAccessTokenExpiresAt",
          "userRefreshToken",
          "userRefreshTokenExpiresAt",
          COALESCE("createdAt", now()),
          now()
        FROM github_installations
        WHERE "userAccessToken" IS NOT NULL OR "userRefreshToken" IS NOT NULL
        ORDER BY "userId", "updatedAt" DESC NULLS LAST
        ON CONFLICT ("userId") DO UPDATE SET
          "accessToken" = EXCLUDED."accessToken",
          "accessTokenExpiresAt" = EXCLUDED."accessTokenExpiresAt",
          "refreshToken" = EXCLUDED."refreshToken",
          "refreshTokenExpiresAt" = EXCLUDED."refreshTokenExpiresAt",
          "updatedAt" = now();
      END IF;
    END
    $$;
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('github_oauth_tokens').ifExists().execute()
}
