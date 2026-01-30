import { Hono } from 'hono'
import { StreamableHTTPTransport } from '@hono/mcp'
import { createConvexMcpServer } from '@/mcp/convex'
import { createPayMcpServer } from '@/mcp/pay'
import type { AppContext } from '@/types/application'

const mcp = new Hono<AppContext>()

// Create the MCP servers and transports
const convexMcp = createConvexMcpServer()
const convexMcpTransport = new StreamableHTTPTransport()

const payMcp = createPayMcpServer()
const payMcpTransport = new StreamableHTTPTransport()

/**
 * MCP endpoint for Convex tools
 *
 * Clients should send MCP requests with context in the request meta:
 * {
 *   "jsonrpc": "2.0",
 *   "method": "tools/call",
 *   "params": {
 *     "name": "call_query",
 *     "arguments": { "path": "messages:list", "args": {} },
 *     "_meta": {
 *       "context": {
 *         "deploymentUrl": "https://xyz.convex.cloud",
 *         "deployKey": "prod:..."
 *       }
 *     }
 *   }
 * }
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

  return convexMcpTransport.handleRequest(c)
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
