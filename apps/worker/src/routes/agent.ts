import { Hono } from 'hono'
import { Sandbox as E2BSandbox } from 'e2b'
import { Configuration, SandboxApi } from '@daytonaio/api-client'
import { db } from '@/lib/db'
import { requireAuth } from '../middleware/auth'
import { isAdmin } from '../middleware/admin'
import type { AppContext } from '@/types/application'
import { config } from '@/lib/config'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

type Preview = { url: string; headers: Record<string, string> }

async function getE2BPreview(sandboxId: string, port: number): Promise<Preview> {
  const sbx = await E2BSandbox.connect(sandboxId)
  return { url: `https://${sbx.getHost(port)}`, headers: {} }
}

async function getDaytonaPreview(sandboxId: string, port: number): Promise<Preview> {
  const api = new SandboxApi(
    new Configuration({
      basePath: config.daytona.serverUrl || 'https://app.daytona.io/api',
      baseOptions: { headers: { Authorization: `Bearer ${config.daytona.apiKey}` } },
    }),
  )
  const { data } = await api.getPortPreviewUrl(sandboxId, port)

  return {
    url: data.url as string,
    headers: {
      'x-daytona-preview-token': data.token as string,
      'x-daytona-skip-preview-warning': 'true',
    },
  }
}

async function getPreview(provider: string, sandboxId: string, port: number): Promise<Preview> {
  if (provider === 'daytona') return getDaytonaPreview(sandboxId, port)
  return getE2BPreview(sandboxId, port)
}

function buildTargetUrl(baseUrl: string, originalUrl: URL, projectId: string) {
  const path = originalUrl.pathname.replace(`/api/agent/${projectId}`, '')
  const target = new URL(baseUrl)
  target.pathname = target.pathname.replace(/\/$/, '') + path
  target.search = originalUrl.search
  return target
}

function buildHeaders(original: Headers, extra: Record<string, string>) {
  const headers = new Headers(original)
  for (const [k, v] of Object.entries(extra)) headers.set(k, v)
  headers.delete('host')
  return headers
}

function isSSE(headers: Headers, path: string) {
  return headers.get('accept')?.includes('text/event-stream') || path.includes('/event')
}

const agent = new Hono<AppContext>()

agent.all(
  '/:id/*',
  zValidator('param', z.object({ id: z.string().uuid() })),
  requireAuth,
  async (c) => {
    const { id: projectId } = c.req.valid('param')

    const project = await db
      .selectFrom('project')
      .select(['organizationId'])
      .where('id', '=', projectId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()

    if (!project) return c.json({ error: 'Project not found' }, 404)

    if (!isAdmin(c.get('user')!)) {
      const membership = await db
        .selectFrom('member')
        .select('id')
        .where('organizationId', '=', project.organizationId)
        .where('userId', '=', c.get('user')!.id)
        .executeTakeFirst()
      if (!membership) return c.json({ error: 'Forbidden' }, 403)
    }

    const sandboxRow = await db
      .selectFrom('sandbox')
      .select(['id', 'provider'])
      .where('projectId', '=', projectId)
      .executeTakeFirst()
    if (!sandboxRow?.id) return c.json({ error: 'Sandbox not found' }, 400)

    try {
      const provider = sandboxRow.provider || config.sandbox.provider
      const preview = await getPreview(provider, sandboxRow.id, 4096)

      const reqUrl = new URL(c.req.url)
      const targetUrl = buildTargetUrl(preview.url, reqUrl, projectId)
      const headers = buildHeaders(c.req.raw.headers, preview.headers)

      const resp = await fetch(
        new Request(targetUrl.toString(), {
          method: c.req.method,
          headers,
          body: c.req.raw.body,
          signal: c.req.raw.signal,
        }),
      )

      const path = reqUrl.pathname.replace(`/api/agent/${projectId}`, '')
      if (!isSSE(headers, path)) return resp

      const outHeaders = new Headers(resp.headers)
      // Essential SSE headers (connection is hop-by-hop and must not be forwarded)
      if (!outHeaders.has('content-type')) {
        outHeaders.set('content-type', 'text/event-stream; charset=utf-8')
      }
      outHeaders.set('cache-control', 'no-cache, no-transform')
      outHeaders.set('x-accel-buffering', 'no')
      return new Response(resp.body, { status: resp.status, headers: outHeaders })
    } catch {
      return c.text('Upstream unavailable', 502)
    }
  },
)

export default agent
