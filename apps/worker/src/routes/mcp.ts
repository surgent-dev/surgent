import { Hono } from 'hono'
import { StreamableHTTPTransport } from '@hono/mcp'
import { createConvexMcpServer } from '@/mcp/convex'
import { createPayMcpServer } from '@/mcp/pay'
import { db } from '@/lib/db'
import type { AppContext } from '@/types/application'

const mcp = new Hono<AppContext>()

// Create the MCP servers and transports
const convexMcp = createConvexMcpServer()
const convexMcpTransport = new StreamableHTTPTransport()

const payMcp = createPayMcpServer()
const payMcpTransport = new StreamableHTTPTransport()

// Hash API key same as gateway (SHA-256 -> base64url)
function base64UrlEncode(bytes: Uint8Array) {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hashApiKey(key: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return base64UrlEncode(new Uint8Array(digest))
}

async function getProjectIdFromApiKey(headers: Headers): Promise<string | null> {
  const raw = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!raw) return null

  const hashed = await hashApiKey(raw)
  const row = await db
    .selectFrom('apikey')
    .select('projectId')
    .where('key', '=', hashed)
    .where('enabled', '=', true)
    .executeTakeFirst()

  return row?.projectId ?? null
}

/**
 * MCP endpoint for Convex tools
 *
 * The projectId is automatically looked up from the API key.
 */
mcp.get('/', async (c) => {
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

mcp.all('/convex', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!convexMcp.isConnected()) {
    await convexMcp.connect(convexMcpTransport)
  }

  // Lookup projectId from API key
  const projectId = await getProjectIdFromApiKey(c.req.raw.headers)
  if (!projectId) {
    return c.json({ error: 'API key not linked to a project' }, 400)
  }

  // Clone request and inject projectId into _meta.context
  const body = await c.req.json()
  if (body.params) {
    body.params._meta = body.params._meta || {}
    body.params._meta.context = { ...body.params._meta.context, projectId }
  }

  return convexMcpTransport.handleRequest(c, body)
})

mcp.all('/pay', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!payMcp.isConnected()) {
    await payMcp.connect(payMcpTransport)
  }

  // Extract API key from headers and inject into request context for POST requests
  if (c.req.method === 'POST') {
    const apiKey =
      c.req.header('x-api-key') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '')

    if (apiKey) {
      const body = await c.req.json()

      // Inject apiKey into params._meta.context
      if (body.params) {
        body.params._meta = body.params._meta || {}
        body.params._meta.context = body.params._meta.context || {}
        body.params._meta.context.apiKey = apiKey
      }

      return payMcpTransport.handleRequest(c, body)
    }
  }

  return payMcpTransport.handleRequest(c)
})

export default mcp
