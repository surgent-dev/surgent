import { db } from "@/lib/db";

export function getProjectById(projectId: string) {
  return db
    .selectFrom("project")
    .selectAll()
    .where("id", "=", projectId)
    .executeTakeFirst();
}

export async function countProjectsByUserId(userId: string): Promise<number> {
  const result = await db
    .selectFrom("project")
    .select(db.fn.countAll().as("count"))
    .where("userId", "=", userId)
    .executeTakeFirst();

  return Number(result?.count ?? 0);
}

export async function createProject(args: {
  userId: string;
  name: string;
  githubUrl?: string;
}): Promise<{ id: string }> {
  const now = new Date();

  const row = await db
    .insertInto("project")
    .values({
      userId: args.userId,
      name: args.name,
      github: { url: args.githubUrl } as any,
      settings: null,
      metadata: null,
      deployment: null,
      sandbox: { status: "pending", isInitialized: false } as any,
      createdAt: now,
      updatedAt: now,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return { id: row.id as string };
}

export async function updateProject(
  projectId: string,
  data: { metadata?: any; sandbox?: any; deployment?: any }
) {
  await db
    .updateTable("project")
    .set({ ...data, updatedAt: new Date() })
    .where("id", "=", projectId)
    .execute();
}

export async function updateDeploymentStatus(
  projectId: string,
  status: string,
  name?: string,
  meta?: { step?: string; error?: string }
) {
  const project = await getProjectById(projectId);
  if (!project) return;

  await updateProject(projectId, {
    deployment: {
      ...(project.deployment || {}),
      status,
      ...(name ? { name } : {}),
      ...(meta?.step ? { step: meta.step } : {}),
      ...(meta?.error ? { error: meta.error } : {}),
      updatedAt: new Date(),
    },
  });
}

