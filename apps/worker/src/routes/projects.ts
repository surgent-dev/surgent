import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import type { ProjectGitHub } from '@/types/github'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { auth } from '@/lib/auth'
import { config } from '@/lib/config'
import { sanitizeHostname, getSandboxPreviewUrl } from '@/lib/utils'
import {
  createDeploymentRecord,
  undeployProject,
  resumeProject,
  deployConvexProd,
  deleteSandbox,
  downloadProject,
  getSandboxLogs,
  redeployVersion,
} from '@/controllers/projects'
import { HttpError } from '@/lib/errors'
import {
  listDeploymentEnvVars,
  setDeploymentEnvVars,
  buildDashboardCredentials,
} from '@/apis/convex'
import { createGitHubApp, GitHubService, getValidUserToken } from '@/apis/github'
import {
  isHostnameAvailable,
  getProjectWithAuth,
  getIntegrationByProvider,
  getEnvVarsByProjectId,
  countProjectsByOrganizationId,
  createProject,
  updateProjectStatus,
  updateDeployment,
  attachApiKeyToProject,
} from '@/services/projects'
import { DaytonaProvider, E2BProvider } from '@/apis/sandbox'
import { inngest } from '@/inngest'
const projects = new Hono<AppContext>()

const idParam = z.object({ id: z.string().uuid() })
const listingBody = z.object({
  title: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().min(1).max(4000),
  imageUrl: z.string().url().optional(),
})

function serializeListing(row: {
  id: string | null
  projectId: string
  title: string
  description: string
  imageUrl: string | null
  status: string
  createdAt?: Date
  updatedAt?: Date
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  }
}

// ── Public routes (no auth required) ──

// GET /projects/marketplace/listings - List all active marketplace listings
projects.get(
  '/marketplace/listings',
  zValidator('query', z.object({ limit: z.coerce.number().int().min(1).max(100).optional() })),
  async (c) => {
    const { limit } = c.req.valid('query')

    const rows = await db
      .selectFrom('listing')
      .innerJoin('project', 'project.id', 'listing.projectId')
      .innerJoin('user', 'user.id', 'project.userId')
      .leftJoin('worker', 'worker.projectId', 'project.id')
      .select([
        'listing.id',
        'listing.projectId',
        'listing.title',
        'listing.description',
        'listing.imageUrl',
        'listing.status',
        'listing.createdAt',
        'listing.updatedAt',
        'project.name as projectName',
        'user.name as sellerName',
        'user.image as sellerImage',
        'worker.scriptName as workerScriptName',
        'worker.status as workerStatus',
      ])
      .where('listing.status', '=', 'active')
      .where('project.deletedAt', 'is', null)
      .orderBy('listing.updatedAt', 'desc')
      .limit(limit ?? 48)
      .execute()

    return c.json(
      rows.map((row) => ({
        ...serializeListing(row),
        projectName: row.projectName,
        sellerName: row.sellerName,
        sellerImage: row.sellerImage,
        liveUrl:
          row.workerScriptName && row.workerStatus === 'active'
            ? `https://${row.workerScriptName}.surgent.site`
            : null,
      })),
    )
  },
)

// GET /projects/marketplace/listings/:id - Get single marketplace listing
projects.get(
  '/marketplace/listings/:id',
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param')

    const row = await db
      .selectFrom('listing')
      .innerJoin('project', 'project.id', 'listing.projectId')
      .innerJoin('user', 'user.id', 'project.userId')
      .leftJoin('worker', 'worker.projectId', 'project.id')
      .select([
        'listing.id',
        'listing.projectId',
        'listing.title',
        'listing.description',
        'listing.imageUrl',
        'listing.status',
        'listing.createdAt',
        'listing.updatedAt',
        'project.name as projectName',
        'user.name as sellerName',
        'user.image as sellerImage',
        'worker.scriptName as workerScriptName',
        'worker.status as workerStatus',
      ])
      .where('listing.id', '=', id)
      .where('listing.status', '=', 'active')
      .where('project.deletedAt', 'is', null)
      .executeTakeFirst()

    if (!row) return c.json({ error: 'Listing not found' }, 404)

    return c.json({
      ...serializeListing(row),
      projectName: row.projectName,
      sellerName: row.sellerName,
      sellerImage: row.sellerImage,
      liveUrl:
        row.workerScriptName && row.workerStatus === 'active'
          ? `https://${row.workerScriptName}.surgent.site`
          : null,
    })
  },
)

// ── Auth required from here ──

projects.use('*', async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'Unauthorized' }, 401)
  return next()
})

// GET /projects/check-hostname - Check if a hostname is available
projects.get(
  '/check-hostname',
  zValidator(
    'query',
    z.object({ name: z.string().min(1).max(63), projectId: z.string().uuid().optional() }),
  ),
  async (c) => {
    const { name, projectId } = c.req.valid('query')
    const sanitized = sanitizeHostname(name)
    if (!sanitized) return c.json({ available: false })
    return c.json({ available: await isHostnameAvailable(sanitized, projectId) })
  },
)

// GET /projects - List all projects for user
projects.get('/', requireAuth, async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return c.json({ error: 'No active organization' }, 400)

  const rows = await db
    .selectFrom('project')
    .innerJoin('member', 'member.organizationId', 'project.organizationId')
    .leftJoin('sandbox', 'sandbox.projectId', 'project.id')
    .leftJoin('worker', 'worker.projectId', 'project.id')
    .select([
      'project.id',
      'project.userId',
      'project.organizationId',
      'project.name',
      'project.status',
      'project.failReason',
      'project.github',
      'project.settings',
      'project.metadata',
      'project.createdAt',
      'project.updatedAt',
      'sandbox.id as sandboxId',
      'sandbox.status as sandboxStatus',
      'sandbox.host as sandboxUrl',
      'worker.scriptName as workerName',
      'worker.status as workerStatus',
      'worker.hostname as workerHostname',
    ])
    .where('member.userId', '=', c.get('user')!.id)
    .where('project.organizationId', '=', organizationId)
    .where('project.deletedAt', 'is', null)
    .orderBy('project.createdAt', 'desc')
    .execute()

  return c.json(
    rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      organizationId: r.organizationId,
      name: r.name,
      status: r.status,
      failReason: r.failReason ?? null,
      github: r.github,
      settings: r.settings,
      metadata: r.metadata,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      sandbox: r.sandboxId
        ? {
            id: r.sandboxId,
            status: r.sandboxStatus,
            url: getSandboxPreviewUrl(
              r.sandboxId,
              Number(config.sandbox.defaultPort),
              r.sandboxUrl,
            ),
          }
        : null,
      worker: r.workerName
        ? { name: r.workerName, status: r.workerStatus, hostname: r.workerHostname }
        : null,
    })),
  )
})

// GET /projects/usage - Usage overview grouped by project
projects.get('/usage', requireAuth, async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return c.json({ error: 'No active organization' }, 400)

  const parsed = z
    .object({
      days: z.coerce.number().int().min(1).max(365).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      projectId: z.string().uuid().optional(),
    })
    .safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Invalid query' }, 400)

  const days = parsed.data.days ?? 30
  const limit = parsed.data.limit ?? 50
  const projectId = parsed.data.projectId

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  const baseAll = db
    .selectFrom('usage')
    .innerJoin('project', 'project.id', 'usage.projectId')
    .innerJoin('member', 'member.organizationId', 'project.organizationId')
    .where('member.userId', '=', c.get('user')!.id)
    .where('project.organizationId', '=', organizationId)
    .where('project.deletedAt', 'is', null)
    .where('usage.deletedAt', 'is', null)
    .where('usage.createdAt', '>=', from)

  const base = projectId ? baseAll.where('usage.projectId', '=', projectId) : baseAll

  const totals = (await base
    .select([
      sql<string>`COALESCE(SUM(cost), 0)::bigint::text`.as('cost'),
      sql<string>`COALESCE(COUNT(*), 0)::text`.as('messages'),
      sql<string>`COALESCE(SUM("usage"."inputTokens"), 0)::bigint::text`.as('inputTokens'),
      sql<string>`COALESCE(SUM("usage"."outputTokens"), 0)::bigint::text`.as('outputTokens'),
    ])
    .executeTakeFirst()) ?? { cost: '0', messages: '0' }

  const projects = await baseAll
    .select([
      'usage.projectId as projectId',
      'project.name as projectName',
      sql<string>`COALESCE(SUM(cost), 0)::bigint::text`.as('cost'),
      sql<string>`COALESCE(COUNT(*), 0)::text`.as('messages'),
      sql<string>`COALESCE(SUM("usage"."inputTokens"), 0)::bigint::text`.as('inputTokens'),
      sql<string>`COALESCE(SUM("usage"."outputTokens"), 0)::bigint::text`.as('outputTokens'),
    ])
    .groupBy(['usage.projectId', 'project.name'])
    .orderBy(sql`COALESCE(SUM(cost), 0)`, 'desc')
    .limit(50)
    .execute()

  const models = await base
    .select([
      'usage.model as model',
      'usage.provider as provider',
      sql<string>`COALESCE(SUM(cost), 0)::bigint::text`.as('cost'),
      sql<string>`COALESCE(COUNT(*), 0)::text`.as('messages'),
      sql<string>`COALESCE(SUM("usage"."inputTokens"), 0)::bigint::text`.as('inputTokens'),
      sql<string>`COALESCE(SUM("usage"."outputTokens"), 0)::bigint::text`.as('outputTokens'),
    ])
    .groupBy(['usage.model', 'usage.provider'])
    .orderBy(
      sql`COALESCE(SUM("usage"."inputTokens"), 0) + COALESCE(SUM("usage"."outputTokens"), 0)`,
      'desc',
    )
    .limit(20)
    .execute()

  const daily = await base
    .select([
      sql<string>`to_char(date_trunc('day', "usage"."createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`.as(
        'date',
      ),
      sql<string>`COALESCE(SUM(cost), 0)::bigint::text`.as('cost'),
      sql<string>`COALESCE(COUNT(*), 0)::text`.as('messages'),
      sql<string>`COALESCE(SUM("usage"."inputTokens"), 0)::bigint::text`.as('inputTokens'),
      sql<string>`COALESCE(SUM("usage"."outputTokens"), 0)::bigint::text`.as('outputTokens'),
    ])
    .groupBy(sql`date_trunc('day', "usage"."createdAt" AT TIME ZONE 'UTC')`)
    .orderBy(sql`date_trunc('day', "usage"."createdAt" AT TIME ZONE 'UTC')`, 'desc')
    .limit(30)
    .execute()

  const history = await base
    .select([
      'usage.id',
      'usage.projectId as projectId',
      'project.name as projectName',
      'usage.model as model',
      'usage.provider as provider',
      'usage.inputTokens as inputTokens',
      'usage.outputTokens as outputTokens',
      'usage.cost',
      'usage.createdAt',
    ])
    .orderBy('usage.createdAt', 'desc')
    .limit(limit)
    .execute()

  return c.json({
    range: { from: from.toISOString(), to: to.toISOString(), days },
    totals,
    projects,
    models,
    daily,
    history: history.map((row) => ({
      ...row,
      createdAt: row.createdAt?.toISOString?.() ?? null,
    })),
  })
})

// GET /projects/:id/listing - Get listing for a project
projects.get('/:id/listing', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  await getProjectWithAuth(id, c.get('user')!)

  const listing = await db
    .selectFrom('listing')
    .selectAll()
    .where('projectId', '=', id)
    .executeTakeFirst()

  if (!listing) return c.json({ listing: null })
  return c.json({ listing: serializeListing(listing) })
})

// POST /projects/:id/listing - Create or update listing
projects.post(
  '/:id/listing',
  zValidator('param', idParam),
  zValidator('json', listingBody),
  async (c) => {
    const { id } = c.req.valid('param')
    const { title, description, imageUrl } = c.req.valid('json')
    const project = await getProjectWithAuth(id, c.get('user')!)

    const now = new Date()
    const nextTitle = title || project.name

    const existing = await db
      .selectFrom('listing')
      .select('id')
      .where('projectId', '=', id)
      .executeTakeFirst()

    if (existing) {
      const updated = await db
        .updateTable('listing')
        .set({
          title: nextTitle,
          description,
          imageUrl: imageUrl ?? null,
          status: 'active',
          updatedAt: now,
        })
        .where('projectId', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()

      return c.json({ listing: serializeListing(updated) })
    }

    const created = await db
      .insertInto('listing')
      .values({
        projectId: id,
        title: nextTitle,
        description,
        imageUrl: imageUrl ?? null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return c.json({ listing: serializeListing(created) })
  },
)

// DELETE /projects/:id/listing - Unlist project
projects.delete('/:id/listing', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  await getProjectWithAuth(id, c.get('user')!)

  await db
    .updateTable('listing')
    .set({ status: 'inactive', updatedAt: new Date() })
    .where('projectId', '=', id)
    .execute()

  return c.json({ unlisted: true })
})

// GET /projects/:id - Get single project
projects.get('/:id', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const project = await getProjectWithAuth(id, c.get('user')!)

  const row = await db
    .selectFrom('project')
    .leftJoin('sandbox', 'sandbox.projectId', 'project.id')
    .leftJoin('worker', 'worker.projectId', 'project.id')
    .select([
      'sandbox.id as sandboxId',
      'sandbox.status as sandboxStatus',
      'sandbox.host as sandboxUrl',
      'worker.scriptName as workerName',
      'worker.status as workerStatus',
      'worker.hostname as workerHostname',
    ])
    .where('project.id', '=', id)
    .executeTakeFirst()

  // Fetch integrations for this project
  const integrations = await db
    .selectFrom('integration')
    .select(['provider', 'status', 'config'])
    .where('projectId', '=', id)
    .execute()

  return c.json({
    ...project,
    sandbox: row?.sandboxId
      ? {
          id: row.sandboxId,
          status: row.sandboxStatus,
          url: getSandboxPreviewUrl(
            row.sandboxId,
            Number(config.sandbox.defaultPort),
            row.sandboxUrl,
          ),
        }
      : null,
    worker: row?.workerName
      ? { name: row.workerName, status: row.workerStatus, hostname: row.workerHostname }
      : null,
    integrations: integrations.map((i) => ({
      provider: i.provider,
      status: i.status,
      config: i.config,
    })),
  })
})

// PATCH /projects/:id - Rename project
projects.patch(
  '/:id',
  zValidator('param', idParam),
  zValidator('json', z.object({ name: z.string().min(1) })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { name } = c.req.valid('json')

    const project = await getProjectWithAuth(id, c.get('user')!)

    await db
      .updateTable('project')
      .set({ name, updatedAt: new Date() })
      .where('id', '=', id)
      .execute()

    return c.json({ updated: true })
  },
)

// DELETE /projects/:id - Soft delete project
projects.delete('/:id', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')

  await getProjectWithAuth(id, c.get('user')!)

  // Delete sandbox before soft deleting project
  await deleteSandbox({ projectId: id })

  await db
    .updateTable('apikey')
    .set({ enabled: false, updatedAt: new Date() })
    .where('projectId', '=', id)
    .execute()

  // Soft delete: set deletedAt instead of hard delete
  await db
    .updateTable('project')
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where('id', '=', id)
    .execute()

  return c.json({ deleted: true })
})

// POST /projects - Create project + fire async initialization via Inngest
projects.post(
  '/',
  zValidator(
    'json',
    z.object({
      githubUrl: z.string(),
      name: z.string().optional(),
      initConvex: z.boolean().optional(),
    }),
  ),
  async (c) => {
    let projectId: string | undefined
    try {
      const { githubUrl, name } = c.req.valid('json')
      const userId = c.get('user')!.id
      const organizationId = c.get('session')?.activeOrganizationId
      if (!organizationId) return c.json({ error: 'No active organization' }, 400)

      const member = await db
        .selectFrom('member')
        .select('id')
        .where('userId', '=', userId)
        .where('organizationId', '=', organizationId)
        .executeTakeFirst()

      if (!member) {
        return c.json({ error: 'Forbidden' }, 403)
      }

      // Validate project limit (fast, synchronous check)
      const MAX_PROJECTS_PER_ORG = 2
      const projectCount = await countProjectsByOrganizationId(organizationId)
      if (projectCount >= MAX_PROJECTS_PER_ORG) {
        return c.json(
          {
            error: `Project limit reached. Maximum ${MAX_PROJECTS_PER_ORG} projects per organization.`,
          },
          400,
        )
      }

      // Create DB record synchronously (so we have an ID to return)
      const projectName = name || 'app'
      const created = await createProject({
        userId,
        organizationId,
        name: projectName,
        githubUrl,
      })
      projectId = created.id

      // Setup API key synchronously (needs user session from request headers)
      const apiKeyResult = await auth.api.createApiKey({
        body: { name: `p-${projectId.slice(0, 8)}` },
        headers: c.req.raw.headers,
      })

      const attached = await attachApiKeyToProject(apiKeyResult.id, projectId, organizationId)
      if (!attached) {
        throw new Error('Failed to attach API key to project')
      }

      await db
        .insertInto('env_var')
        .values({
          projectId,
          environment: 'development',
          key: 'SURGENT_API_KEY',
          value: apiKeyResult.key,
          createdAt: new Date(),
          updatedAt: new Date(),
          destination: 'server',
        })
        .execute()

      // Fire Inngest event — sandbox provisioning runs in the background
      try {
        await inngest.send({
          name: 'project/create.requested',
          data: {
            projectId,
            userId,
            organizationId,
            githubUrl,
            name: projectName,
          },
        })
      } catch (sendErr) {
        await updateProjectStatus(projectId, 'failed', 'Failed to dispatch creation event').catch(
          () => {},
        )
        throw sendErr
      }

      return c.json({ id: projectId })
    } catch (err) {
      if (projectId) {
        await updateProjectStatus(
          projectId,
          'failed',
          err instanceof Error ? err.message : 'Project creation failed',
        ).catch(() => {})
      }
      const status = err instanceof HttpError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Failed to create project'
      console.error('[projects] create failed', {
        userId: c.get('user')?.id,
        error: message,
      })
      return c.json({ error: message }, status as 400 | 500)
    }
  },
)
// POST /projects/:id/deploy - Deploy project to Cloudflare
projects.post(
  '/:id/deploy',
  zValidator('param', idParam),
  zValidator('json', z.object({ deployName: z.string().optional() })),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const { deployName } = c.req.valid('json')

      console.log('[deploy] request', {
        projectId: id,
        userId: c.get('user')?.id,
        deployName,
      })

      const project = await getProjectWithAuth(id, c.get('user')!)
      const name = deployName ? sanitizeHostname(deployName) : undefined

      if (name) {
        const available = await isHostnameAvailable(name, id)
        if (!available) {
          return c.json(
            { error: `Hostname "${name}" is already taken. Please choose a different name.` },
            409,
          )
        }
      }

      const deployment = await createDeploymentRecord(id, name)

      try {
        await inngest.send({
          name: 'project/deploy.requested',
          data: {
            projectId: id,
            deployName: name,
            deploymentId: deployment.id,
          },
        })
      } catch (sendErr) {
        await updateDeployment(deployment.id, {
          status: 'deploy_failed',
          error: 'Failed to dispatch deployment event',
          finishedAt: new Date(),
        }).catch(() => {})
        throw sendErr
      }

      console.log('[deploy] scheduled', { projectId: id, deploymentId: deployment.id })
      return c.json({ deploymentId: deployment.id, status: 'queued' })
    } catch (err: any) {
      console.error('[deploy] request failed', {
        userId: c.get('user')?.id,
        error: err?.message ?? String(err),
      })
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /projects/:id/deployments - Get deployment history for a project
projects.get('/:id/deployments', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  await getProjectWithAuth(id, c.get('user')!)

  const deployments = await db
    .selectFrom('deployment')
    .select([
      'id',
      'status',
      'createdAt',
      'startedAt',
      'finishedAt',
      'error',
      'cloudflareVersionId',
      'hostname',
      'rollbackOf',
      'scriptName',
    ])
    .where('projectId', '=', id)
    .orderBy('createdAt', 'desc')
    .execute()

  const response = deployments.map((row: any) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : undefined,
    deployedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
    error: row.error ?? undefined,
    cloudflareVersionId: row.cloudflareVersionId ?? null,
    hostname: row.hostname ?? null,
    rollbackOf: row.rollbackOf ?? null,
    scriptName: row.scriptName,
  }))

  return c.json(response)
})

// POST /projects/:id/undeploy - Undeploy project from Cloudflare
projects.post('/:id/undeploy', zValidator('param', idParam), async (c) => {
  try {
    const { id } = c.req.valid('param')

    console.log('[undeploy] request', {
      projectId: id,
      userId: c.get('user')?.id,
    })

    const project = await getProjectWithAuth(id, c.get('user')!)

    undeployProject({ projectId: id }).catch((err) => {
      console.error('[undeploy] background failed', {
        projectId: id,
        error: err?.stack ?? err?.message ?? String(err),
      })
    })

    console.log('[undeploy] scheduled', { projectId: id })
    return c.json({ scheduled: true })
  } catch (err: any) {
    console.error('[undeploy] request failed', {
      userId: c.get('user')?.id,
      error: err?.message ?? String(err),
    })
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

// POST /projects/:id/cloudflare-redeploy - Redeploy specific version (rollback)
projects.post(
  '/:id/cloudflare-redeploy',
  zValidator('param', idParam),
  zValidator('json', z.object({ versionId: z.string() })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { versionId } = c.req.valid('json')
    const project = await getProjectWithAuth(id, c.get('user')!)

    try {
      await redeployVersion({ projectId: id, versionId })
      return c.json({ scheduled: true, versionId })
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Failed to redeploy version'
      console.error('[cloudflare-redeploy] failed', { projectId: id, versionId, error: message })
      return c.json({ error: message }, status as 400 | 500)
    }
  },
)

// POST /projects/:id/deployment/confirm-hostname - Confirm hostname change without deploying
projects.post(
  '/:id/deployment/confirm-hostname',
  zValidator('param', idParam),
  zValidator('json', z.object({ name: z.string().min(1).max(63) })),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const { name } = c.req.valid('json')

      console.log('[confirm-hostname] request', {
        projectId: id,
        userId: c.get('user')?.id,
        name,
      })

      const project = await getProjectWithAuth(id, c.get('user')!)

      const sanitized = sanitizeHostname(name)

      const available = await isHostnameAvailable(sanitized, id)
      if (!available) {
        return c.json(
          { error: `Hostname "${sanitized}" is already taken. Please choose a different name.` },
          409,
        )
      }

      const previewUrl = `https://${sanitized}.${config.cloudflare.deployDomain}`
      const now = new Date()

      await db
        .updateTable('worker')
        .set({
          scriptName: sanitized,
          hostname: previewUrl,
          updatedAt: now,
        })
        .where('projectId', '=', id)
        .execute()

      const latest = await db
        .selectFrom('deployment')
        .select(['id'])
        .where('projectId', '=', id)
        .orderBy('createdAt', 'desc')
        .executeTakeFirst()

      if (latest) {
        await db
          .updateTable('deployment')
          .set({
            scriptName: sanitized,
            hostname: previewUrl,
          })
          .where('id', '=', latest.id)
          .execute()
      }

      console.log('[confirm-hostname] success', { projectId: id, name: sanitized })
      return c.json({ confirmed: true, name: sanitized, previewUrl })
    } catch (err: any) {
      console.error('[confirm-hostname] request failed', {
        userId: c.get('user')?.id,
        error: err?.message ?? String(err),
      })
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /projects/:id/activate - Resume project sandbox (alias)
projects.post('/:id/activate', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const project = await getProjectWithAuth(id, c.get('user')!)

  const sandboxRow = await db
    .selectFrom('sandbox')
    .select(['id'])
    .where('projectId', '=', id)
    .executeTakeFirst()
  const sandboxId = sandboxRow?.id
  if (!sandboxId) return c.json({ error: 'Sandbox not found' }, 400)

  resumeProject({ projectId: id, sandboxId }).catch(() => {})

  return c.json({ scheduled: true })
})

// GET /projects/:id/logs - Get PM2 logs from sandbox
projects.get('/:id/logs', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const project = await getProjectWithAuth(id, c.get('user')!)

  try {
    const logs = await getSandboxLogs({ projectId: id })
    return c.json(logs)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof Error ? err.message : 'Failed to get logs'
    return c.json({ error: message }, status as 400 | 500)
  }
})

// GET /projects/:id/health - Check if sandbox preview is reachable
projects.get('/:id/health', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  await getProjectWithAuth(id, c.get('user')!)

  const sandboxRow = await db
    .selectFrom('sandbox')
    .select(['host'])
    .where('projectId', '=', id)
    .executeTakeFirst()
  const previewUrl = sandboxRow?.host
  if (!previewUrl) return c.json({ status: 'no_sandbox' })

  try {
    const res = await fetch(previewUrl, { method: 'HEAD' })
    if (res.status === 502 || res.status === 503) {
      return c.json({ status: 'paused' })
    }
    return c.json({ status: 'running' })
  } catch {
    return c.json({ status: 'paused' })
  }
})

// GET /projects/:id/download - Download project as tar.gz
projects.get('/:id/download', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')

  await getProjectWithAuth(id, c.get('user')!)

  try {
    const { buffer, filename } = await downloadProject({ projectId: id })

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof Error ? err.message : 'Download failed'
    console.error('[download] failed', { projectId: id, error: message })
    return c.json({ error: message }, status as 400 | 500)
  }
})

// ============================================
// Convex Integration Endpoints
// ============================================

type ConvexEnv = 'development' | 'production'

interface ConvexCredentials {
  deploymentName: string
  deploymentUrl: string
  deployKey: string
}

async function getConvexCredentials(
  projectId: string,
  env: ConvexEnv,
): Promise<ConvexCredentials | null> {
  const integration = await getIntegrationByProvider(projectId, 'convex')
  if (!integration?.id) return null

  const config = integration.config as Record<string, any> | null
  const deployment = config?.deployments?.[env]
  if (!deployment?.name || !deployment?.url) return null

  const envVars = await getEnvVarsByProjectId(projectId, env, integration.id)
  const deployKey = envVars.find((v) => v.key === 'CONVEX_DEPLOY_KEY')?.value
  if (!deployKey) return null

  return {
    deploymentName: deployment.name,
    deploymentUrl: deployment.url,
    deployKey,
  }
}

// POST /projects/:id/convex/deploy/prod - Promote to production
projects.post('/:id/convex/deploy/prod', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const project = await getProjectWithAuth(id, c.get('user')!)

  await deployConvexProd({ projectId: id })
  return c.json({ deployed: true })
})

// GET /projects/:id/convex/env - List deployment environment variables
projects.get('/:id/convex/env', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const project = await getProjectWithAuth(id, c.get('user')!)

  const creds = await getConvexCredentials(id, 'development')
  if (!creds) return c.json({ error: 'Convex not provisioned' }, 400)

  const vars = await listDeploymentEnvVars(creds.deploymentUrl, creds.deployKey)
  return c.json({ environmentVariables: vars })
})

// POST /projects/:id/convex/env - Update deployment environment variables
projects.post(
  '/:id/convex/env',
  zValidator('param', idParam),
  zValidator('json', z.object({ vars: z.record(z.string(), z.string()) })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { vars } = c.req.valid('json')

    const project = await getProjectWithAuth(id, c.get('user')!)

    const creds = await getConvexCredentials(id, 'development')
    if (!creds) return c.json({ error: 'Convex not provisioned' }, 400)

    await setDeploymentEnvVars(creds.deploymentUrl, creds.deployKey, vars)
    return c.json({ updated: true })
  },
)

// GET /projects/:id/convex/dashboard - Get dashboard embed credentials
projects.get(
  '/:id/convex/dashboard',
  zValidator('param', idParam),
  zValidator('query', z.object({ env: z.enum(['development', 'production']).optional() })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { env = 'development' } = c.req.valid('query')

    const project = await getProjectWithAuth(id, c.get('user')!)

    const creds = await getConvexCredentials(id, env)
    if (!creds) return c.json({ error: 'Convex not provisioned' }, 400)

    return c.json(buildDashboardCredentials(creds))
  },
)

function isOriginTrusted(origin: string, trustedOrigins: string[]): boolean {
  try {
    const originUrl = new URL(origin)
    const originHost = `${originUrl.protocol}//${originUrl.host}`.toLowerCase()
    return trustedOrigins.some((trusted) => {
      try {
        const trustedUrl = new URL(trusted)
        const trustedHost = `${trustedUrl.protocol}//${trustedUrl.host}`.toLowerCase()
        return originHost === trustedHost
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

// ============================================
// GitHub Integration Endpoints
// ============================================

// GET /projects/:id/github/status - Check GitHub installation and connection status
projects.get('/:id/github/status', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const project = await getProjectWithAuth(id, c.get('user')!)

  const installations = await db
    .selectFrom('github_installations')
    .selectAll()
    .where('userId', '=', userId)
    .execute()
  const hasToken = Boolean(await getValidUserToken(userId))

  const installationList = installations.map((item) => ({
    id: Number(item.installationId),
    account: item.accountLogin,
    accountType: item.accountType,
  }))

  const projectGithub = project.github as ProjectGitHub | null

  if (!projectGithub?.repoOwner) {
    return c.json({
      installed: installationList.length > 0,
      connected: false,
      hasToken,
      installations: installationList,
    })
  }

  return c.json({
    installed: true,
    connected: true,
    hasToken,
    installations: installationList,
    repo: {
      owner: projectGithub.repoOwner,
      name: projectGithub.repoName,
      fullName: `${projectGithub.repoOwner}/${projectGithub.repoName}`,
      installationId: projectGithub.installationId,
      lastPushedSha: projectGithub.lastPushedSha,
      lastPushAt: projectGithub.lastPushAt,
    },
  })
})

// GET /projects/:id/github/install-url - Get GitHub App installation URL
projects.get('/:id/github/install-url', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const project = await getProjectWithAuth(id, c.get('user')!)

  const githubApp = createGitHubApp()
  if (!githubApp) return c.json({ error: 'GitHub App not configured' }, 500)

  const url = await githubApp.buildInstallUrl(userId, id)
  return c.json({ url })
})

// GET /projects/:id/github/repos - List repos accessible to user's installation
projects.get('/:id/github/repos', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  await getProjectWithAuth(id, c.get('user')!)

  const installation = await db
    .selectFrom('github_installations')
    .selectAll()
    .where('userId', '=', userId)
    .executeTakeFirst()

  if (!installation) {
    return c.json({ error: 'No GitHub installation found' }, 400)
  }

  const githubApp = createGitHubApp()
  if (!githubApp) {
    return c.json({ error: 'GitHub App not configured' }, 500)
  }

  try {
    const repos = await githubApp.listInstallationRepos(installation.installationId)
    return c.json({ repos })
  } catch (err) {
    console.error('[github] Failed to list repos', err)
    return c.json({ error: 'Failed to list repositories' }, 500)
  }
})

// POST /projects/:id/github/connect - Connect project to a GitHub repo
projects.post(
  '/:id/github/connect',
  zValidator('param', idParam),
  zValidator(
    'json',
    z.object({
      owner: z.string(),
      repo: z.string(),
      repoId: z.number(),
      defaultBranch: z.string().optional(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const { owner, repo, repoId, defaultBranch } = c.req.valid('json')
    const userId = c.get('user')!.id

    const project = await getProjectWithAuth(id, c.get('user')!)

    const installation = await db
      .selectFrom('github_installations')
      .selectAll()
      .where('userId', '=', userId)
      .executeTakeFirst()

    if (!installation) {
      return c.json({ error: 'No GitHub installation found' }, 400)
    }

    const github: ProjectGitHub = {
      installationId: installation.installationId,
      repoOwner: owner,
      repoName: repo,
      repoId,
      defaultBranch: defaultBranch || 'main',
    }

    await db
      .updateTable('project')
      .set({ github, updatedAt: new Date() })
      .where('id', '=', id)
      .execute()

    // Update git remote in sandbox
    const sandboxRow = await db
      .selectFrom('sandbox')
      .select(['id', 'provider'])
      .where('projectId', '=', id)
      .executeTakeFirst()

    if (sandboxRow?.id) {
      const repoUrl = `https://github.com/${owner}/${repo}.git`
      const cwd = `/home/user/workspace/${id.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'project'}`

      try {
        const providerName = sandboxRow.provider || config.sandbox.provider
        const sandbox =
          providerName === 'daytona'
            ? await new DaytonaProvider(
                config.daytona.apiKey,
                config.daytona.serverUrl,
                config.daytona.snapshot,
              ).resume(sandboxRow.id)
            : await new E2BProvider(config.e2b.template).resume(sandboxRow.id)

        const remoteCheck = await sandbox.exec('git remote get-url origin 2>/dev/null', { cwd })
        if (remoteCheck.code === 0) {
          await sandbox.exec(`git remote set-url origin '${repoUrl}'`, { cwd })
        } else {
          await sandbox.exec(`git remote add origin '${repoUrl}'`, { cwd })
        }
        console.log('[github] Updated git remote to', repoUrl)
      } catch (err) {
        console.warn('[github] Failed to update git remote', err)
      }
    }

    return c.json({ connected: true })
  },
)

// POST /projects/:id/github/disconnect - Disconnect project from GitHub repo
projects.post('/:id/github/disconnect', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  await getProjectWithAuth(id, c.get('user')!)

  await db
    .updateTable('project')
    .set({ github: null, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()

  return c.json({ disconnected: true })
})

// POST /projects/:id/github/create-repo - Create a new GitHub repo and connect it to the project
projects.post(
  '/:id/github/create-repo',
  zValidator('param', idParam),
  zValidator(
    'json',
    z.object({
      name: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid repository name'),
      description: z.string().optional(),
      private: z.boolean().optional(),
      installationId: z.number().optional(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const { name, description, private: isPrivate, installationId } = c.req.valid('json')
    const userId = c.get('user')!.id

    const project = await getProjectWithAuth(id, c.get('user')!)

    const installation = installationId
      ? await db
          .selectFrom('github_installations')
          .selectAll()
          .where('userId', '=', userId)
          .where('installationId', '=', installationId)
          .executeTakeFirst()
      : await db
          .selectFrom('github_installations')
          .selectAll()
          .where('userId', '=', userId)
          .executeTakeFirst()

    if (!installation) {
      return c.json(
        {
          error: 'GitHub installation not found. Please install the GitHub App first.',
        },
        400,
      )
    }

    // Get valid OAuth token (auto-refreshes if expired)
    const accessToken = await getValidUserToken(userId)

    try {
      if (!accessToken) {
        return c.json(
          {
            error: 'GitHub authorization missing or expired. Please authorize the GitHub App.',
          },
          401,
        )
      }

      // Create the repository
      const isOrg = installation.accountType.toLowerCase() === 'organization'
      const createResult = isOrg
        ? await GitHubService.createOrganizationRepository({
            org: installation.accountLogin,
            name,
            description,
            private: isPrivate ?? false,
            auto_init: false,
            token: accessToken,
          })
        : await GitHubService.createUserRepository({
            name,
            description,
            private: isPrivate ?? false,
            auto_init: false,
            token: accessToken,
          })

      if (!createResult.success || !createResult.repository) {
        return c.json({ error: createResult.error || 'Failed to create repository' }, 400)
      }

      const repo = createResult.repository

      // Auto-connect the new repo to the project
      const github: ProjectGitHub = {
        installationId: installation.installationId,
        repoOwner: repo.owner.login,
        repoName: repo.name,
        repoId: repo.id,
        defaultBranch: repo.default_branch,
      }

      await db
        .updateTable('project')
        .set({ github, updatedAt: new Date() })
        .where('id', '=', id)
        .execute()

      // Initialize git and push to new repo (single shell call)
      const sandboxRow = await db
        .selectFrom('sandbox')
        .select(['id', 'provider'])
        .where('projectId', '=', id)
        .executeTakeFirst()

      let pushed = false
      let sha: string | undefined

      if (sandboxRow?.id) {
        const cleanUrl = `https://github.com/${repo.owner.login}/${repo.name}.git`
        const cwd = `/home/user/workspace/${id.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'project'}`
        const branch = repo.default_branch || 'main'

        try {
          const providerName = sandboxRow.provider || config.sandbox.provider
          const sandbox =
            providerName === 'daytona'
              ? await new DaytonaProvider(
                  config.daytona.apiKey,
                  config.daytona.serverUrl,
                  config.daytona.snapshot,
                ).resume(sandboxRow.id)
              : await new E2BProvider(config.e2b.template).resume(sandboxRow.id)

          // Get auth URL
          const githubApp = createGitHubApp()
          let authUrl = cleanUrl
          if (githubApp) {
            const { token } = await githubApp.getInstallationToken(installation.installationId)
            authUrl = `https://x-access-token:${token}@github.com/${repo.owner.login}/${repo.name}.git`
          }

          // Commit and push to GitHub
          const script = `
cd '${cwd}' || exit 1

# Stage and commit changes
git add -A
git diff --cached --quiet || git commit -m 'Initial commit'

# Set remote and push
git remote remove origin 2>/dev/null || true
git remote add origin '${authUrl}'

if git push -u origin '${branch}' 2>&1; then
  git remote set-url origin '${cleanUrl}'
  echo "PUSHED:true"
  echo "SHA:$(git rev-parse HEAD)"
else
  git remote set-url origin '${cleanUrl}'
  echo "PUSHED:false"
fi
`
          const res = await sandbox.exec(script, { cwd: '/', timeout: 60000 })
          const output = res.output || ''

          pushed = output.includes('PUSHED:true')
          const shaMatch = output.match(/SHA:([a-f0-9]+)/)
          sha = shaMatch?.[1]

          if (pushed && sha) {
            await db
              .updateTable('project')
              .set({
                github: { ...github, lastPushedSha: sha, lastPushAt: new Date().toISOString() },
                updatedAt: new Date(),
              })
              .where('id', '=', id)
              .execute()
          }

          console.log('[github] Initialized git and pushed:', pushed)
        } catch (err) {
          console.warn('[github] Failed to init git (sandbox may be offline)', err)
        }
      }

      return c.json({
        success: true,
        pushed,
        sha,
        repo: {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          default_branch: repo.default_branch,
          html_url: repo.html_url,
        },
      })
    } catch (err) {
      console.error('[github] Create repo failed', err)
      const message = err instanceof Error ? err.message : 'Failed to create repository'
      return c.json({ error: message }, 500)
    }
  },
)

export default projects
