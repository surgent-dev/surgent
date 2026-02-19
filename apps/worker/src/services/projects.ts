import { db } from '@/lib/db'
import { sql } from 'kysely'
import type { EnvDestination, ProjectMetadata } from '@repo/db'
import { isAdmin } from '@/middleware/admin'
import { HttpError } from '@/lib/errors'

type User = { id: string; role?: string | null }

export async function getProjectWithAuth(id: string, user: User) {
  const project = await db
    .selectFrom('project')
    .selectAll()
    .where('id', '=', id)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()

  if (!project) throw new HttpError(404, 'Project not found')

  if (!isAdmin(user)) {
    const member = await db
      .selectFrom('member')
      .select('id')
      .where('userId', '=', user.id)
      .where('organizationId', '=', project.organizationId)
      .executeTakeFirst()

    if (!member) {
      throw new HttpError(403, 'Forbidden')
    }
  }

  return project
}

export function getProjectById(id: string) {
  return db
    .selectFrom('project')
    .selectAll()
    .where('id', '=', id)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
}

export function getOAuthClientByProjectId(projectId: string) {
  return db
    .selectFrom('oauthClient')
    .select(['clientId'])
    .where('projectId', '=', projectId)
    .executeTakeFirst()
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
    .select(['key', 'value', 'destination'])
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
      status: 'provisioning',
      github: args.githubUrl ? { url: args.githubUrl } : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: row.id as string }
}

export async function updateProject(id: string, data: { metadata?: ProjectMetadata }) {
  await db
    .updateTable('project')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

export async function updateProvisioningStep(id: string, step: string) {
  await db
    .updateTable('project')
    .set({
      metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ provisioningStep: step })}::jsonb`,
      updatedAt: new Date(),
    } as any)
    .where('id', '=', id)
    .execute()
}

export async function updateProjectStatus(
  id: string,
  status: 'provisioning' | 'ready' | 'failed',
  failReason?: string | null,
) {
  await db
    .updateTable('project')
    .set({
      status,
      failReason: status === 'failed' ? (failReason ?? null) : null,
      updatedAt: new Date(),
    })
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
  envSnapshot?: any | null
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
      envSnapshot: args.envSnapshot ?? null,
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
    envSnapshot?: any | null
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
      envSnapshot: data.envSnapshot,
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

export async function isHostnameAvailable(
  scriptName: string,
  excludeProjectId?: string,
): Promise<boolean> {
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

export async function getDeploymentByVersionId(
  projectId: string,
  versionId: string,
): Promise<{ id: string } | null> {
  const row = await db
    .selectFrom('deployment')
    .select(['id'])
    .where('projectId', '=', projectId)
    .where('cloudflareVersionId', '=', versionId)
    .executeTakeFirst()
  return row ? { id: row.id as string } : null
}

// ============================================================================
// Integrations
// ============================================================================

export async function createIntegration(args: {
  projectId: string
  provider: string
  config?: Record<string, unknown>
  status?: string
}) {
  const row = await db
    .insertInto('integration')
    .values({
      projectId: args.projectId,
      provider: args.provider,
      config: args.config ?? null,
      status: args.status ?? 'connected',
      createdAt: new Date(),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: row.id as string }
}

export async function getIntegrationByProvider(projectId: string, provider: string) {
  return db
    .selectFrom('integration')
    .selectAll()
    .where('projectId', '=', projectId)
    .where('provider', '=', provider)
    .executeTakeFirst()
}

export async function updateIntegrationConfig(id: string, config: unknown) {
  await db.updateTable('integration').set({ config }).where('id', '=', id).execute()
}

export async function deleteIntegration(id: string) {
  await db.deleteFrom('integration').where('id', '=', id).execute()
}

// ============================================================================
// Environment Variables
// ============================================================================

export async function upsertEnvVar(args: {
  projectId: string
  environment: string
  key: string
  value: string | null
  destination?: EnvDestination | null
  integrationId?: string | null
}) {
  const now = new Date()
  const result = await db
    .updateTable('env_var')
    .set({
      value: args.value,
      destination: args.destination ?? null,
      integrationId: args.integrationId ?? null,
      updatedAt: now,
    })
    .where('projectId', '=', args.projectId)
    .where('environment', '=', args.environment)
    .where('key', '=', args.key)
    .executeTakeFirst()

  if (result && result.numUpdatedRows > 0n) return

  await db
    .insertInto('env_var')
    .values({
      projectId: args.projectId,
      environment: args.environment,
      key: args.key,
      value: args.value,
      destination: args.destination ?? null,
      integrationId: args.integrationId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .execute()
}

interface EnvVarWithDestination {
  value: string
  destination: EnvDestination
}

export async function upsertEnvVars(
  projectId: string,
  environment: string,
  vars: Record<string, string | EnvVarWithDestination>,
  integrationId?: string | null,
) {
  for (const [key, val] of Object.entries(vars)) {
    const isWithDestination = typeof val === 'object' && 'destination' in val
    const value = isWithDestination ? val.value : val
    const destination = isWithDestination ? val.destination : null
    await upsertEnvVar({ projectId, environment, key, value, destination, integrationId })
  }
}

export async function deleteEnvVar(projectId: string, environment: string, key: string) {
  await db
    .deleteFrom('env_var')
    .where('projectId', '=', projectId)
    .where('environment', '=', environment)
    .where('key', '=', key)
    .execute()
}

export async function deleteEnvVarsByIntegration(integrationId: string) {
  await db.deleteFrom('env_var').where('integrationId', '=', integrationId).execute()
}
