import { Hono } from 'hono'
import { Configuration, SandboxApi } from '@daytonaio/api-client'
import { db } from '@repo/db'
import { requireAuth } from '../middleware/auth'
import type { AppContext } from '@/types/application'
import { config } from '@/lib/config'

const agent = new Hono<AppContext>()

function createSandboxApi() {
  const basePath = config.daytona.apiUrl || 'https://app.daytona.io/api'
  const apiKey = config.daytona.apiKey

  return new SandboxApi(
    new Configuration({
      basePath,
      baseOptions: { headers: { Authorization: `Bearer ${apiKey}` } },
    })
  )
}

// Proxy all OpenCode endpoints: /api/agent/:id/* → Daytona preview URL for port 4096
agent.all('/:id/*', requireAuth, async (c) => {
  const projectId = c.req.param('id')

  const project = await db
    .selectFrom('project')
    .select(['sandbox', 'userId'])
    .where('id', '=', projectId)
    .executeTakeFirst()

  if (!project) {
    return c.json({ error: 'Project not found' }, 404)
  }
  if (project.userId !== c.get('user')?.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const sandbox = project.sandbox as { id?: string } | null
  if (!sandbox?.id) {
    return c.json({ error: 'Sandbox not found' }, 400)
  }

  if (!config.daytona.apiUrl || !config.daytona.apiKey) {
    return c.text('Daytona not configured', 500)
  }

  try {
    const api = createSandboxApi()
    const { data } = await api.getPortPreviewUrl(sandbox.id, 4096)

    const url = new URL(c.req.url)
    const path = url.pathname.replace(`/api/agent/${projectId}`, '')

    const targetUrl = new URL(data.url as string)
    targetUrl.pathname = `${targetUrl.pathname.replace(/\/$/, '')}${path}`
    targetUrl.search = url.search

    const headers = new Headers(c.req.raw.headers)
    headers.set('x-daytona-preview-token', data.token as string)
    headers.set('x-daytona-skip-preview-warning', 'true')
    headers.delete('host')

    const accept = headers.get('accept') || ''
    const isSse = accept.includes('text/event-stream') || path === '/event' || path === '/global/event'

    const upstreamResp = await fetch(
      new Request(targetUrl.toString(), {
        method: c.req.method,
        headers,
        body: c.req.raw.body,
        signal: c.req.raw.signal,
      })
    )

    if (!isSse) {
      return upstreamResp
    }

    // Prevent buffering for SSE streams
    const outHeaders = new Headers(upstreamResp.headers)
    outHeaders.set('cache-control', 'no-cache, no-transform')

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: outHeaders,
    })
  } catch {
    return c.text('Upstream unavailable', 502)
  }
})

export default agent
