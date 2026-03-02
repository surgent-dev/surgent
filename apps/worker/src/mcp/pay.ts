import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  requiredId,
  hashApiKey,
  normalizeSlug,
  getProductsWithPrices,
  resolveActiveAccountId,
} from '@/lib/pay/utils'
import type { PayEnv } from '@/lib/pay/types'

export interface McpContext {
  apiKey: string
}

const envSchema = {
  env: z
    .enum(['test', 'live'])
    .optional()
    .describe('Environment: "test" (sandbox) or "live". Defaults to API key environment.'),
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
      inputSchema: envSchema,
    },
    async (args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.apiKey) return err('Missing apiKey in context')

      try {
        const scope = await resolveProjectId(ctx.apiKey)
        if (!scope) return err('Invalid API key')
        const env = (args.env as PayEnv) || scope.env

        const accountId = await resolveActiveAccountId(scope.projectId, env)
        const { products: allProducts, pricesByProduct } = await getProductsWithPrices(
          scope.projectId,
          env,
          accountId,
        )
        const products = allProducts.filter((p) => !p.isArchived)

        if (!products.length) return ok({ products: [], env })

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

        return ok({ products: result, env })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  server.registerTool(
    'create_product_with_price',
    {
      title: 'Create Product with Price',
      description: `Create a new product and its price in a single step.

Use this to set up a purchasable item. Creates both the product record and an initial price.

Input:
- name: Product display name
- slug: URL-friendly identifier (must be unique per project)
- description: Optional product description
- price: Amount in minor units (cents). 999 = $9.99
- priceCurrency: 3-letter ISO code (default "usd")
- recurringInterval: "week", "month", or "year" for subscriptions. Omit for one-time.

Returns:
- product: { productId, productGroup, slug }
- price: { priceId, priceAmount, priceCurrency, recurringInterval }

REQUIRES _meta.context with apiKey (project-scoped API key).`,
      inputSchema: {
        ...envSchema,
        name: z.string().min(1).max(200).describe('Product name'),
        slug: z.string().min(1).max(200).describe('URL-friendly slug for the product'),
        description: z.string().max(2000).optional().describe('Product description'),
        price: z
          .number()
          .int()
          .positive()
          .describe('Price amount in minor units (cents). e.g. 999 = $9.99'),
        priceCurrency: z
          .string()
          .length(3)
          .default('usd')
          .describe('ISO currency code (e.g. "usd", "eur")'),
        recurringInterval: z
          .enum(['week', 'month', 'year'])
          .optional()
          .describe('Billing interval for subscriptions. Omit for one-time payments.'),
      },
    },
    async (args, extra) => {
      const ctx = getContext(extra)
      if (!ctx?.apiKey) return err('Missing apiKey in context')

      try {
        const scope = await resolveProjectId(ctx.apiKey)
        if (!scope) return err('Invalid API key')
        const env = (args.env as PayEnv) || scope.env

        const slug = normalizeSlug(args.slug)
        if (!slug) return err('Invalid slug')

        const accountId = await resolveActiveAccountId(scope.projectId, env)
        if (!accountId) return err('No active payment account found. Connect one first.')

        const existingSlug = await db
          .selectFrom('product')
          .select('id')
          .where('projectId', '=', scope.projectId)
          .where('env', '=', env)
          .where('slug', '=', slug)
          .executeTakeFirst()
        if (existingSlug) return err('Product with this slug already exists in project')

        const productGroup = slug

        const result = await db.transaction().execute(async (trx) => {
          const versions = await trx
            .selectFrom('product')
            .select('version')
            .where('projectId', '=', scope.projectId)
            .where('env', '=', env)
            .where('productGroup', '=', productGroup)
            .forUpdate()
            .execute()
          const version = versions.reduce((max, r) => Math.max(max, r.version || 0), 0) + 1
          const now = new Date()

          const insertedProduct = await trx
            .insertInto('product')
            .values({
              productGroup,
              projectId: scope.projectId,
              accountId,
              name: args.name,
              description: args.description || null,
              slug,
              version,
              isDefault: false,
              isArchived: false,
              processor: 'whop',
              env,
              createdAt: now,
              updatedAt: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow()

          const productId = requiredId(insertedProduct.id, 'product')

          const insertedPrice = await trx
            .insertInto('product_price')
            .values({
              productId,
              name: args.name,
              description: args.description || null,
              slug: null,
              priceAmount: args.price,
              priceCurrency: args.priceCurrency.toLowerCase(),
              recurringInterval: args.recurringInterval || null,
              isDefault: true,
              processor: 'whop',
              createdAt: now,
              updatedAt: now,
            })
            .returning('id')
            .executeTakeFirstOrThrow()

          return {
            productId,
            productGroup,
            slug,
            version,
            priceId: requiredId(insertedPrice.id, 'product price'),
          }
        })

        return ok({
          message: 'Product and price created successfully',
          product: {
            productId: result.productId,
            productGroup: result.productGroup,
            slug: result.slug,
          },
          price: {
            priceId: result.priceId,
            priceAmount: args.price,
            priceCurrency: args.priceCurrency.toLowerCase(),
            recurringInterval: args.recurringInterval || null,
          },
        })
      } catch (e) {
        return err(errMsg(e))
      }
    },
  )

  return server
}
