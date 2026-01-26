import { db } from '@/lib/db'

export function getProjectById(id: string) {
  return db.selectFrom('project').selectAll().where('id', '=', id).where('deletedAt', 'is', null).executeTakeFirst()
}

export function getSandboxByProjectId(projectId: string) {
  return db.selectFrom('sandbox').selectAll().where('projectId', '=', projectId).executeTakeFirst()
}

export function getWorkerByProjectId(projectId: string) {
  return db.selectFrom('worker').selectAll().where('projectId', '=', projectId).executeTakeFirst()
}

export function getEnvVarsByProjectId(projectId: string, environment: string) {
  return db
    .selectFrom('env_var')
    .select(['key', 'value'])
    .where('projectId', '=', projectId)
    .where('environment', '=', environment)
    .execute()
}

export async function countProjectsByOrganizationId(organizationId: string) {
  const row = await db
    .selectFrom('project')
    .select(db.fn.countAll().as('count'))
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
  return Number(row?.count ?? 0)
}

export async function createProject(args: {
  userId: string
  organizationId: string
  name: string
  githubUrl?: string
}) {
  const now = new Date()
  const row = await db
    .insertInto('project')
    .values({
      userId: args.userId,
      organizationId: args.organizationId,
      name: args.name,
      github: { url: args.githubUrl } as any,
      createdAt: now,
      updatedAt: now,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: row.id as string }
}

export async function updateProject(id: string, data: { metadata?: any }) {
  await db
    .updateTable('project')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

export async function upsertSandbox(args: {
  id: string
  projectId: string
  provider: string
  status: string
  host?: string | null
}) {
  const result = await db
    .updateTable('sandbox')
    .set({
      provider: args.provider,
      status: args.status,
      host: args.host ?? null,
      updatedAt: new Date(),
    })
    .where('projectId', '=', args.projectId)
    .executeTakeFirst()

  if (result && result.numUpdatedRows > 0n) return

  await db
    .insertInto('sandbox')
    .values({
      id: args.id,
      projectId: args.projectId,
      provider: args.provider,
      status: args.status,
      host: args.host ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute()
}

export async function upsertWorker(args: {
  projectId: string
  accountId: string
  scriptName: string
  dispatchNamespace?: string | null
  hostname?: string | null
  status?: string | null
}) {
  const result = await db
    .updateTable('worker')
    .set({
      accountId: args.accountId,
      scriptName: args.scriptName,
      dispatchNamespace: args.dispatchNamespace ?? null,
      hostname: args.hostname ?? null,
      status: args.status ?? null,
      updatedAt: new Date(),
    })
    .where('projectId', '=', args.projectId)
    .executeTakeFirst()

  if (result && result.numUpdatedRows > 0n) return

  await db
    .insertInto('worker')
    .values({
      projectId: args.projectId,
      accountId: args.accountId,
      scriptName: args.scriptName,
      dispatchNamespace: args.dispatchNamespace ?? null,
      hostname: args.hostname ?? null,
      status: args.status ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute()
}

export async function createDeployment(args: {
  projectId: string
  scriptName: string
  status: string
  hostname?: string | null
  error?: string | null
  startedAt?: Date | null
  finishedAt?: Date | null
  cloudflareDeploymentId?: string | null
  cloudflareVersionId?: string | null
  rollbackOf?: string | null
}) {
  const row = await db
    .insertInto('deployment')
    .values({
      projectId: args.projectId,
      scriptName: args.scriptName,
      status: args.status,
      hostname: args.hostname ?? null,
      error: args.error ?? null,
      startedAt: args.startedAt ?? null,
      finishedAt: args.finishedAt ?? null,
      cloudflareDeploymentId: args.cloudflareDeploymentId ?? null,
      cloudflareVersionId: args.cloudflareVersionId ?? null,
      rollbackOf: args.rollbackOf ?? null,
      createdAt: new Date(),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: row.id as string }
}

export async function updateDeployment(
  id: string,
  data: {
    status?: string
    hostname?: string | null
    error?: string | null
    startedAt?: Date | null
    finishedAt?: Date | null
    cloudflareDeploymentId?: string | null
    cloudflareVersionId?: string | null
    rollbackOf?: string | null
  },
) {
  await db
    .updateTable('deployment')
    .set({
      status: data.status,
      hostname: data.hostname,
      error: data.error,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      cloudflareDeploymentId: data.cloudflareDeploymentId,
      cloudflareVersionId: data.cloudflareVersionId,
      rollbackOf: data.rollbackOf,
    })
    .where('id', '=', id)
    .execute()
}
