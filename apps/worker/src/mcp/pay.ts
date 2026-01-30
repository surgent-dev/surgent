import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Surpay } from '@surgent-dev/surpay'
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
- product: Object with id, name, slug, description
- prices: Array of price objects with amount, currency, interval, etc.

HINTS FOR CHECKOUT:
- To create a checkout, use the SDK's checkout.create() method
- product_id: Use the product's UUID or slug
- price_id: Use the price's UUID or slug (optional - defaults to first price if omitted)
- customer_id: Your app's user identifier (e.g., user ID from your auth system)

If the user wants to setup payments (create products, configure Stripe, etc.), refer them to the payment skill.

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
        const activeProducts = result.data?.filter((p) => !p.product.is_archived) ?? []
        return ok({ products: activeProducts })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  return server
}
