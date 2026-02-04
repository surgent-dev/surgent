import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Surpay } from '@surgent/pay'
import { config } from '@/lib/config'

// Context passed to MCP tools - contains Surpay API key (scoped to project)
export interface McpContext {
  apiKey: string
}

// Response helpers
type McpResponse = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (data: Record<string, unknown>): McpResponse => ({
  content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }],
})
const err = (error: string): McpResponse => ({
  content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
  isError: true,
})
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function getContext(extra: Record<string, unknown>): McpContext | undefined {
  const meta = extra._meta as { context?: unknown } | undefined
  const ctx = meta?.context
  if (!ctx || typeof ctx !== 'object') return undefined
  return ctx as McpContext
}

/**
 * Create the Pay MCP server with billing tools
 */
export function createPayMcpServer(): McpServer {
  const server = new McpServer({
    name: 'pay-mcp',
    version: '1.0.0',
  })

  // Tool: List Products with Prices
  server.registerTool(
    'list_products',
    {
      title: 'List Products with Prices',
      description: `List all products with their prices for a project.

Returns an array of products, each containing:
- product: Object with id, name, slug, description, isArchived
- prices: Array of price objects with priceAmount, priceCurrency, recurringInterval, etc.

FOR CONVEX APPS - Use @surgent/pay-convex SDK:
1. Create convex/pay.ts with Surpay config and identify() function
2. Use createCheckout action for authenticated users (uses identify() for customerId)
3. Use guestCheckout action for anonymous users (pass customerId explicitly)
4. Use check action to verify product access
5. Use listProducts action to show available products

CHECKOUT ARGS:
- productSlug: Human-readable slug (e.g., "pro-plan") - RECOMMENDED
- productId: UUID (alternative to slug)
- priceId: Optional - defaults to first/default price
- successUrl/cancelUrl: Redirect URLs after checkout

GUEST CHECKOUT:
- Store a random UUID in localStorage as customerId for anonymous users
- Pass customerEmail/customerName for contact info

REQUIRES _meta.context with apiKey (project-scoped API key).`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.apiKey) return err('Missing apiKey in context')

      try {
        const client = new Surpay({ apiKey: ctx.apiKey, baseUrl: config.surpay.baseUrl })
        const result = await client.products.listWithPrices()
        if (result.error) return err(result.error.message || 'Failed to list products')
        const activeProducts = result.data?.filter((p) => !p.product.isArchived) ?? []
        return ok({ products: activeProducts })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  return server
}
