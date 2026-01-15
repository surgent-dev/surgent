import { db } from "@/lib/db"

export async function createLog(args: { projectId: string; status: string; message: string }) {
  await db
    .insertInto("deployment_logs")
    .values({
      projectId: args.projectId,
      status: args.status,
      message: args.message,
    })
    .execute()
}

export async function getLogsByProjectId(projectId: string) {
  return db
    .selectFrom("deployment_logs")
    .selectAll()
    .where("projectId", "=", projectId)
    .orderBy("createdAt", "desc")
    .execute()
}
