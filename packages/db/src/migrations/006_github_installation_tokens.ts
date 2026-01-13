import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("github_installations")
    .addColumn("userAccessToken", "text")
    .addColumn("userAccessTokenExpiresAt", "timestamp")
    .addColumn("userRefreshToken", "text")
    .addColumn("userRefreshTokenExpiresAt", "timestamp")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("github_installations")
    .dropColumn("userAccessToken")
    .dropColumn("userAccessTokenExpiresAt")
    .dropColumn("userRefreshToken")
    .dropColumn("userRefreshTokenExpiresAt")
    .execute();
}
