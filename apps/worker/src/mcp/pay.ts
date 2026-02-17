import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { db } from '@/lib/db'
import {
  requiredId,
  hashApiKey,
  getProductsWithPrices,
  resolveActiveAccountId,
} from '@/lib/pay/utils'
import type { PayEnv } from '@/lib/pay/types'

export interface McpContext {
  apiKey: string
}

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

async function resolveProjectId(
  apiKey: string,
): Promise<{ projectId: string; env: PayEnv } | null> {
  const hashed = await hashApiKey(apiKey)

  const row = await db
    .selectFrom('apikey')
    .select(['projectId', 'expiresAt', 'env'])
    .where('key', '=', hashed)
    .where('enabled', '=', true)
    .executeTakeFirst()

  if (!row) return null
  if (row.expiresAt && row.expiresAt <= new Date()) return null

  if (!row.projectId) return null
  return {
    projectId: row.projectId,
    env: row.env === 'test' ? 'test' : 'live',
  }
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

CHECKOUT FLOW:
1. Call list_products to get available products and prices
2. Use the Pay API POST /checkout with a priceId to create a checkout session
3. Redirect the user to the checkout page or embed the Whop checkout component

CHECKOUT ARGS:
- priceId: UUID of the price to checkout
- productId: UUID (alternative)
- customerId: ID of the customer making the purchase
- redirectUrl: Where to send the user after payment

REQUIRES _meta.context with apiKey (project-scoped API key).`,
      inputSchema: {},
    },
    async (_args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.apiKey) return err('Missing apiKey in context')

      try {
        const scope = await resolveProjectId(ctx.apiKey)
        if (!scope) return err('Invalid API key')

        const accountId = await resolveActiveAccountId(scope.projectId, scope.env)
        const { products: allProducts, pricesByProduct } = await getProductsWithPrices(
          scope.projectId,
          scope.env,
          accountId,
        )
        const products = allProducts.filter((p) => !p.isArchived)

        if (!products.length) return ok({ products: [] })

        const result = products.map((product) => {
          const id = requiredId(product.id, 'product')
          return {
            product: {
              id,
              productGroup: product.productGroup,
              name: product.name,
              slug: product.slug,
              description: product.description,
              isArchived: product.isArchived,
            },
            prices: (pricesByProduct.get(id) || []).map((price) => ({
              id: requiredId(price.id, 'product price'),
              name: price.name,
              description: price.description,
              priceAmount: price.priceAmount,
              priceCurrency: price.priceCurrency,
              recurringInterval: price.recurringInterval,
              isDefault: price.isDefault,
            })),
          }
        })

        return ok({ products: result })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  return server
}
