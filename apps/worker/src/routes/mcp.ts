import { Hono, type Context } from 'hono'
import { StreamableHTTPTransport } from '@hono/mcp'
import { createConvexMcpServer } from '@/mcp/convex'
import { createPayMcpServer } from '@/mcp/pay'
import { authorizePayApiKey } from '@/lib/pay/apikeys'
import type { AppContext } from '@/types/application'
import { requireAdmin } from '@/middleware/admin'
import { db } from '@/lib/db'

const mcp = new Hono<AppContext>()

// Create the MCP servers and transports
const convexMcp = createConvexMcpServer()
const convexMcpTransport = new StreamableHTTPTransport()

const payMcp = createPayMcpServer()
const payMcpTransport = new StreamableHTTPTransport()

type McpRequestBody = {
  params?: {
    _meta?: {
      context?: Record<string, unknown>
    }
  }
}

function addMcpContext(body: McpRequestBody, context: Record<string, unknown>) {
  if (!body.params) return body

  body.params._meta = {
    ...body.params._meta,
    context: {
      ...body.params._meta?.context,
      ...context,
    },
  }

  return body
}

function readProjectId(c: Context<AppContext>) {
  return c.req.header('x-project-id') || c.req.query('projectId') || null
}

async function projectExists(projectId: string) {
  const project = await db
    .selectFrom('project')
    .select('id')
    .where('id', '=', projectId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()

  return Boolean(project)
}

/**
 * MCP endpoints for project-scoped tools.
 */
mcp.get('/', requireAdmin, async (c) => {
  if (!convexMcp.isConnected()) {
    await convexMcp.connect(convexMcpTransport)
  }
  const convexConnected = convexMcp.isConnected()

  if (!payMcp.isConnected()) {
    await payMcp.connect(payMcpTransport)
  }
  const payConnected = payMcp.isConnected()

  return c.json({
    convex: convexConnected
      ? { status: 'connected' }
      : { status: 'failed', error: 'Not connected' },
    pay: payConnected ? { status: 'connected' } : { status: 'failed', error: 'Not connected' },
  })
})

mcp.all('/convex', requireAdmin, async (c) => {
  const projectId = readProjectId(c)
  if (!projectId) return c.json({ error: 'projectId is required' }, 400)
  if (!(await projectExists(projectId))) return c.json({ error: 'Project not found' }, 404)

  if (!convexMcp.isConnected()) {
    await convexMcp.connect(convexMcpTransport)
  }

  if (c.req.method !== 'POST') return convexMcpTransport.handleRequest(c)

  const body = addMcpContext(await c.req.json(), { projectId })
  return convexMcpTransport.handleRequest(c, body)
})

mcp.all('/pay', async (c) => {
  const auth = await authorizePayApiKey(c.req.raw.headers)
  if (!auth?.projectId) return c.json({ error: 'Unauthorized' }, 401)

  if (!payMcp.isConnected()) {
    await payMcp.connect(payMcpTransport)
  }

  if (c.req.method === 'POST') {
    const body = addMcpContext(await c.req.json(), {
      projectId: auth.projectId,
      env: auth.env,
    })

    return payMcpTransport.handleRequest(c, body)
  }

  return payMcpTransport.handleRequest(c)
})

export default mcp
