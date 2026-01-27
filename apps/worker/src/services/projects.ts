import { db } from '@/lib/db'

export async function getProjectWithAuth(id: string, userId: string) {
  const row = await db
    .selectFrom('project')
    .leftJoin('member', (join) =>
      join.onRef('member.organizationId', '=', 'project.organizationId').on('member.userId', '=', userId),
    )
    .selectAll('project')
    .select('member.id as memberId')
    .where('project.id', '=', id)
    .where('project.deletedAt', 'is', null)
    .executeTakeFirst()

  if (!row) return { error: 'Project not found', status: 404 as const }
  if (!row.memberId) return { error: 'Forbidden', status: 403 as const }

  const { memberId: _, ...project } = row
  return { project }
}

export async function attachApiKeyToProject(
  apiKeyId: string,
  projectId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await db
    .updateTable('apikey')
    .set({ projectId, organizationId })
    .where('id', '=', apiKeyId)
    .executeTakeFirst()
  return result.numUpdatedRows > 0n
}

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
  const slug =
    args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + `-${crypto.randomUUID().slice(0, 8)}`
  const row = await db
    .insertInto('project')
    .values({
      userId: args.userId,
      organizationId: args.organizationId,
      name: args.name,
      slug,
      github: args.githubUrl ? { url: args.githubUrl } : null,
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

export async function isHostnameAvailable(scriptName: string, excludeProjectId?: string): Promise<boolean> {
  let query = db.selectFrom('worker').select('id').where('scriptName', '=', scriptName)

  if (excludeProjectId) {
    query = query.where('projectId', '!=', excludeProjectId)
  }

  const existing = await query.executeTakeFirst()
  return !existing
}

export async function getLatestDeploymentScriptName(projectId: string): Promise<string | null> {
  const row = await db
    .selectFrom('deployment')
    .select(['scriptName'])
    .where('projectId', '=', projectId)
    .orderBy('createdAt', 'desc')
    .executeTakeFirst()
  return row?.scriptName ?? null
}

export async function getDeploymentByVersionId(projectId: string, versionId: string): Promise<{ id: string } | null> {
  const row = await db
    .selectFrom('deployment')
    .select(['id'])
    .where('projectId', '=', projectId)
    .where('cloudflareVersionId', '=', versionId)
    .executeTakeFirst()
  return row ? { id: row.id as string } : null
}
