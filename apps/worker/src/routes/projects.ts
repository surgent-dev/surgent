import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { config } from '@/lib/config'
import {
  deployProject,
  createDeploymentRecord,
  undeployProject,
  initializeProject,
  resumeProject,
  deployConvexProd,
  deleteSandbox,
  downloadProject,
  getSandboxLogs,
  HttpError,
  redeployVersion,
} from '@/controllers/projects'
import { listDeploymentEnvVars, setDeploymentEnvVars, buildDashboardCredentials } from '@/apis/convex'
import { createGitHubApp, GitHubService } from '@/apis/github'
import { ungzip } from 'pako'

const projects = new Hono<AppContext>()

const idParam = z.object({ id: z.string().uuid() })

projects.use('*', async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'Unauthorized' }, 401)
  return next()
})

async function getProject(id: string, userId: string) {
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

function sanitizeDeployName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

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
      github: r.github,
      settings: r.settings,
      metadata: r.metadata,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      sandbox: r.sandboxId ? { id: r.sandboxId, status: r.sandboxStatus, url: r.sandboxUrl } : null,
      worker: r.workerName ? { name: r.workerName, status: r.workerStatus, hostname: r.workerHostname } : null,
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
    .orderBy(sql`COALESCE(SUM("usage"."inputTokens"), 0) + COALESCE(SUM("usage"."outputTokens"), 0)`, 'desc')
    .limit(20)
    .execute()

  const daily = await base
    .select([
      sql<string>`to_char(date_trunc('day', "usage"."createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`.as('date'),
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

// GET /projects/:id - Get single project
projects.get('/:id', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)

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

  return c.json({
    ...result.project,
    sandbox: row?.sandboxId ? { id: row.sandboxId, status: row.sandboxStatus, url: row.sandboxUrl } : null,
    worker: row?.workerName ? { name: row.workerName, status: row.workerStatus, hostname: row.workerHostname } : null,
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

    const result = await getProject(id, c.get('user')!.id)
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }

    await db.updateTable('project').set({ name, updatedAt: new Date() }).where('id', '=', id).execute()

    return c.json({ updated: true })
  },
)

// DELETE /projects/:id - Soft delete project
projects.delete('/:id', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')

  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  // Delete sandbox before soft deleting project
  await deleteSandbox({ projectId: id })

  await db.updateTable('apikey').set({ enabled: false, updatedAt: new Date() }).where('projectId', '=', id).execute()

  // Soft delete: set deletedAt instead of hard delete
  await db.updateTable('project').set({ deletedAt: new Date(), updatedAt: new Date() }).where('id', '=', id).execute()

  return c.json({ deleted: true })
})

// POST /projects - Create + Initialize project (no id provided by client)
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
    try {
      const { githubUrl, name, initConvex } = c.req.valid('json')
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

      const result = await initializeProject({
        githubUrl,
        userId,
        organizationId,
        name,
        initConvex,
        headers: c.req.raw.headers,
      })

      return c.json({ id: result.projectId })
    } catch (err) {
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

      const result = await getProject(id, c.get('user')!.id)
      if ('error' in result) return c.json({ error: result.error }, result.status)
      const name = deployName ? sanitizeDeployName(deployName) : undefined

      const deployment = await createDeploymentRecord(id, name)

      deployProject({ projectId: id, deployName: name, deploymentId: deployment.id }).catch((err) => {
        console.error('[deploy] background failed', {
          projectId: id,
          deploymentId: deployment.id,
          error: err?.stack ?? err?.message ?? String(err),
        })
      })

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
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

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

    const result = await getProject(id, c.get('user')!.id)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    const row = result.project

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
    const result = await getProject(id, c.get('user')!.id)
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }

    try {
      await redeployVersion(id, versionId)
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

      const result = await getProject(id, c.get('user')!.id)
      if ('error' in result) return c.json({ error: result.error }, result.status)

      const sanitized = sanitizeDeployName(name)
      const previewUrl = `https://${sanitized}.surgent.site`
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
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  const row = result.project

  const sandboxRow = await db.selectFrom('sandbox').select(['id']).where('projectId', '=', id).executeTakeFirst()
  const sandboxId = sandboxRow?.id
  if (!sandboxId) return c.json({ error: 'Sandbox not found' }, 400)

  resumeProject({ projectId: id, sandboxId }).catch(() => {})

  return c.json({ scheduled: true })
})

// GET /projects/:id/logs - Get PM2 logs from sandbox
projects.get('/:id/logs', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)

  try {
    const logs = await getSandboxLogs(id)
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
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ status: result.status === 404 ? 'not_found' : 'forbidden' }, result.status)
  const row = result.project

  const sandboxRow = await db.selectFrom('sandbox').select(['host']).where('projectId', '=', id).executeTakeFirst()
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

  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  try {
    const { buffer, filename } = await downloadProject(id)

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

// Convex prod deploy (promote)
projects.post('/:id/convex/deploy/prod', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)

  await deployConvexProd({ projectId: id })
  return c.json({ deployed: true })
})

// GET /projects/:id/convex/env - List all environment variables
projects.get('/:id/convex/env', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  const row = result.project

  const convex = (row.metadata as any)?.convex
  if (!convex?.deploymentUrl || !convex?.deployKey) {
    return c.json({ error: 'Convex not provisioned' }, 400)
  }

  const vars = await listDeploymentEnvVars(convex.deploymentUrl, convex.deployKey)
  return c.json({ environmentVariables: vars })
})

// POST /projects/:id/convex/env - Update environment variables
projects.post(
  '/:id/convex/env',
  zValidator('param', idParam),
  zValidator('json', z.object({ vars: z.record(z.string(), z.string()) })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { vars } = c.req.valid('json')

    const result = await getProject(id, c.get('user')!.id)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    const row = result.project

    const convex = (row.metadata as any)?.convex
    if (!convex?.deploymentUrl || !convex?.deployKey) {
      return c.json({ error: 'Convex not provisioned' }, 400)
    }

    await setDeploymentEnvVars(convex.deploymentUrl, convex.deployKey, vars)
    return c.json({ updated: true })
  },
)

// GET /projects/:id/convex/dashboard - Get dashboard embed credentials
projects.get('/:id/convex/dashboard', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProject(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  const row = result.project

  const convex = (row.metadata as any)?.convex
  if (!convex?.deploymentName || !convex?.deploymentUrl || !convex?.deployKey) {
    return c.json({ error: 'Convex not provisioned' }, 400)
  }

  const credentials = buildDashboardCredentials({
    deploymentName: convex.deploymentName,
    deploymentUrl: convex.deploymentUrl,
    deployKey: convex.deployKey,
  })
  return c.json(credentials)
})

// ============================================
// GitHub Integration Endpoints
// ============================================

interface ProjectGitHub {
  installationId: number
  repoOwner: string
  repoName: string
  repoId: number
  defaultBranch?: string
  lastPushedSha?: string
  lastPushAt?: string
}

// GET /projects/:id/github/status - Check GitHub installation and connection status
projects.get('/:id/github/status', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const result = await getProject(id, userId)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  const installations = await db.selectFrom('github_installations').selectAll().where('userId', '=', userId).execute()
  const oauthLinked = installations.some((item) => item.userAccessToken)
  const installationList = installations.map((item) => ({
    id: item.installationId,
    account: item.accountLogin,
    accountType: item.accountType,
  }))
  const installed = installationList.length > 0

  if (!installed) {
    return c.json({
      installed: false,
      connected: false,
      oauthLinked,
      installations: [],
    })
  }

  const projectGithub = result.project.github as ProjectGitHub | null
  const connectedInstallation = projectGithub?.installationId
    ? installationList.find((item) => item.id === projectGithub.installationId)
    : installationList[0]

  if (!projectGithub?.repoOwner) {
    return c.json({
      installed: true,
      connected: false,
      oauthLinked,
      installation: connectedInstallation,
      installations: installationList,
    })
  }

  return c.json({
    installed: true,
    connected: true,
    oauthLinked,
    installation: connectedInstallation,
    installations: installationList,
    repo: {
      owner: projectGithub.repoOwner,
      name: projectGithub.repoName,
      fullName: `${projectGithub.repoOwner}/${projectGithub.repoName}`,
      lastPushedSha: projectGithub.lastPushedSha,
      lastPushAt: projectGithub.lastPushAt,
    },
  })
})

// GET /projects/:id/github/install-url - Get GitHub App installation URL
projects.get('/:id/github/install-url', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const result = await getProject(id, userId)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  const githubApp = createGitHubApp()
  if (!githubApp) {
    return c.json({ error: 'GitHub App not configured' }, 500)
  }

  const url = await githubApp.buildInstallUrl(userId, id)
  return c.json({ url })
})

// GET /projects/:id/github/repos - List repos accessible to user's installation
projects.get('/:id/github/repos', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const result = await getProject(id, userId)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

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

    const result = await getProject(id, userId)
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }

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

    await db.updateTable('project').set({ github, updatedAt: new Date() }).where('id', '=', id).execute()

    return c.json({ connected: true })
  },
)

// POST /projects/:id/github/disconnect - Disconnect project from GitHub repo
projects.post('/:id/github/disconnect', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const result = await getProject(id, userId)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  await db.updateTable('project').set({ github: null, updatedAt: new Date() }).where('id', '=', id).execute()

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

    const result = await getProject(id, userId)
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }

    const installation = installationId
      ? await db
          .selectFrom('github_installations')
          .selectAll()
          .where('userId', '=', userId)
          .where('installationId', '=', installationId)
          .executeTakeFirst()
      : await db.selectFrom('github_installations').selectAll().where('userId', '=', userId).executeTakeFirst()

    if (!installation) {
      return c.json(
        {
          error: 'GitHub installation not found. Please install the GitHub App first.',
        },
        400,
      )
    }

    const oauthToken = await db
      .selectFrom('github_installations')
      .select(['userAccessToken', 'userAccessTokenExpiresAt'])
      .where('userId', '=', userId)
      .where('userAccessToken', 'is not', null)
      .executeTakeFirst()

    try {
      if (!oauthToken?.userAccessToken) {
        return c.json(
          {
            error: 'GitHub authorization missing. Please authorize the GitHub App to create repositories.',
          },
          400,
        )
      }
      if (oauthToken.userAccessTokenExpiresAt && new Date(oauthToken.userAccessTokenExpiresAt) <= new Date()) {
        return c.json(
          {
            error: 'GitHub authorization expired. Please authorize again.',
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
            token: oauthToken.userAccessToken,
          })
        : await GitHubService.createUserRepository({
            name,
            description,
            private: isPrivate ?? false,
            token: oauthToken.userAccessToken,
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

      await db.updateTable('project').set({ github, updatedAt: new Date() }).where('id', '=', id).execute()

      return c.json({
        success: true,
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

// POST /projects/:id/github/push - Push project files to connected repo
projects.post('/:id/github/push', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const userId = c.get('user')!.id

  const result = await getProject(id, userId)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  const projectGithub = result.project.github as ProjectGitHub | null
  if (!projectGithub?.repoOwner) {
    return c.json({ error: 'No GitHub repo connected' }, 400)
  }

  const githubApp = createGitHubApp()
  if (!githubApp) {
    return c.json({ error: 'GitHub App not configured' }, 500)
  }

  try {
    // Get installation token
    const { token } = await githubApp.getInstallationToken(projectGithub.installationId)

    // Download project files
    const { buffer } = await downloadProject(id)

    // Extract files from tar.gz
    const files = extractFilesFromTarGz(buffer)

    if (files.length === 0) {
      return c.json({ error: 'No files to push' }, 400)
    }

    // Push to GitHub
    const pushResult = await GitHubService.pushFilesToRepository(files, {
      token,
      repositoryHtmlUrl: `https://github.com/${projectGithub.repoOwner}/${projectGithub.repoName}`,
    })

    if (!pushResult.success) {
      if (pushResult.status === 404) {
        await db.updateTable('project').set({ github: null, updatedAt: new Date() }).where('id', '=', id).execute()
        return c.json({ error: 'Repository not found. Connection removed.' }, 404)
      }
      return c.json({ error: pushResult.error || 'Push failed' }, 500)
    }

    // Update project with last push info
    const updatedGithub: ProjectGitHub = {
      ...projectGithub,
      lastPushedSha: pushResult.commitSha,
      lastPushAt: new Date().toISOString(),
    }

    await db.updateTable('project').set({ github: updatedGithub, updatedAt: new Date() }).where('id', '=', id).execute()

    return c.json({ success: true, sha: pushResult.commitSha })
  } catch (err) {
    console.error('[github] Push failed', err)
    const message = err instanceof Error ? err.message : 'Push failed'
    return c.json({ error: message }, 500)
  }
})

/**
 * Extract files from a tar.gz buffer
 */
function extractFilesFromTarGz(buffer: Buffer): Array<{ filePath: string; fileContents: string; isBinary?: boolean }> {
  // Decompress gzip
  const decompressed = ungzip(new Uint8Array(buffer))

  const files: Array<{
    filePath: string
    fileContents: string
    isBinary?: boolean
  }> = []
  let offset = 0

  while (offset < decompressed.length) {
    // Read tar header (512 bytes)
    const header = decompressed.slice(offset, offset + 512)

    // Check for end of archive (empty block)
    if (header.every((b) => b === 0)) break

    // Extract filename (first 100 bytes, null-terminated)
    let nameEnd = 0
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++
    const name = new TextDecoder().decode(header.slice(0, nameEnd))

    // Extract file size (octal, bytes 124-135)
    const sizeStr = new TextDecoder().decode(header.slice(124, 136)).replace(/\0/g, '').trim()
    const size = parseInt(sizeStr, 8) || 0

    // Extract file type (byte 156)
    const type = header[156]

    offset += 512 // Move past header

    // Type 0 or ASCII '0' (48) = regular file
    if ((type === 0 || type === 48) && size > 0 && name && !name.endsWith('/')) {
      const content = decompressed.slice(offset, offset + size)
      const isBinary = content.some((b) => b === 0)

      // Remove the first path component (project folder name)
      const pathParts = name.split('/')
      const cleanPath = pathParts.slice(1).join('/')

      if (cleanPath) {
        if (isBinary) {
          files.push({
            filePath: cleanPath,
            fileContents: Buffer.from(content).toString('base64'),
            isBinary: true,
          })
        } else {
          files.push({
            filePath: cleanPath,
            fileContents: new TextDecoder().decode(content),
          })
        }
      }
    }

    // Move to next file (size rounded up to 512-byte boundary)
    offset += Math.ceil(size / 512) * 512
  }

  return files
}

export default projects
