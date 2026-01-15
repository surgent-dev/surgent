import { Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("deployment_logs")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("projectId", "uuid", (col) => col.notNull().references("project.id").onDelete("cascade"))
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema.createIndex("deployment_logs_projectId_idx").on("deployment_logs").column("projectId").execute()

  await db.schema
    .createIndex("deployment_logs_projectId_createdAt_idx")
    .on("deployment_logs")
    .columns(["projectId", "createdAt"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("deployment_logs").execute()
}
