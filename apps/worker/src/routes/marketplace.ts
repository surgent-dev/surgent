import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type Whop from '@whop/sdk'
import type { AppContext } from '@/types/application'
import { db } from '@repo/db'
import { requireAuth } from '../middleware/auth'
import { getWhopClient } from '@/services/whop'
import {
  getMerchant,
  createMerchant,
  updateMerchantWhopCompanyId,
  createProduct,
  updateProduct,
  getProductsByMerchantId,
  getProductById,
  getProductWithMerchant,
  getProductByProjectId,
  getAllProducts,
  createProductPrice,
  getActivePricesByProductId,
  getPriceById,
  createOrder,
} from '@/services/marketplace'

const marketplace = new Hono<AppContext>()

// GET /merchant - Get current user's merchant profile
marketplace.get('/merchant', requireAuth, async (c) => {
  const userId = c.get('user')!.id
  const merchant = await getMerchant(userId)

  if (!merchant) {
    return c.json({ error: 'Merchant not found' }, 404)
  }

  return c.json(merchant)
})

// POST /merchant/onboard - Create merchant and optionally Whop company
marketplace.post(
  '/merchant/onboard',
  requireAuth,
  zValidator('json', z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    createWhopCompany: z.boolean().optional(),
  })),
  async (c) => {
    const user = c.get('user')!
    const { name, email, createWhopCompany } = c.req.valid('json')

    // Check if already a merchant
    const existing = await getMerchant(user.id)
    if (existing) {
      return c.json({ error: 'Already a merchant', merchant: existing }, 400)
    }

    let whopCompanyId: string | undefined

    // Optionally create Whop company for merchant
    if (createWhopCompany) {
      const whop = getWhopClient(c.env)
      const company = await whop.companies.create({
        email: email ?? user.email,
        parent_company_id: c.env.PLATFORM_COMPANY_ID,
        title: name,
        metadata: { internal_user_id: user.id },
      })
      whopCompanyId = company.id
    }

    const merchant = await createMerchant({
      id: user.id,
      name,
      email: email ?? user.email,
      whopCompanyId,
    })

    return c.json(merchant, 201)
  }
)

// POST /merchant/connect-whop - Connect existing Whop company to merchant
marketplace.post(
  '/merchant/connect-whop',
  requireAuth,
  zValidator('json', z.object({
    whopCompanyId: z.string().min(1),
  })),
  async (c) => {
    const user = c.get('user')!
    const { whopCompanyId } = c.req.valid('json')

    const merchant = await getMerchant(user.id)
    if (!merchant) {
      return c.json({ error: 'Merchant not found' }, 404)
    }

    if (merchant.whopCompanyId) {
      return c.json({ error: 'Already connected to Whop' }, 400)
    }

    await updateMerchantWhopCompanyId(merchant.id, whopCompanyId)
    return c.json({ connected: true })
  }
)

// GET /products - List merchant's products
marketplace.get('/products', requireAuth, async (c) => {
  const user = c.get('user')!
  const merchant = await getMerchant(user.id)

  if (!merchant) {
    return c.json({ error: 'Merchant not found' }, 404)
  }

  const products = await getProductsByMerchantId(merchant.id)
  return c.json(products)
})

// GET /products/by-project/:projectId - Get product by project ID
marketplace.get(
  '/products/by-project/:projectId',
  requireAuth,
  zValidator('param', z.object({ projectId: z.string().uuid() })),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const userId = c.get('user')!.id

    const project = await db
      .selectFrom('project')
      .select(['id', 'userId'])
      .where('id', '=', projectId)
      .executeTakeFirst()

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }
    if (project.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const product = await getProductByProjectId(projectId)

    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }

    const prices = await getActivePricesByProductId(product.id!)
    return c.json({ ...product, prices })
  }
)

// GET /browse - List all active products for marketplace
marketplace.get('/browse', async (c) => {
  const products = await getAllProducts()
  return c.json(products)
})

// POST /products - Create product with initial price
marketplace.post(
  '/products',
  requireAuth,
  zValidator('json', z.object({
    projectId: z.string().uuid(),
    title: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
    previewUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    price: z.object({
      code: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().length(3),
    }),
  })),
  async (c) => {
    const user = c.get('user')!
    const { projectId, title, slug, description, previewUrl, thumbnailUrl, price } = c.req.valid('json')

    const project = await db
      .selectFrom('project')
      .select(['id', 'userId'])
      .where('id', '=', projectId)
      .executeTakeFirst()

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }
    if (project.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const merchant = await getMerchant(user.id)
    if (!merchant) {
      return c.json({ error: 'Merchant not found. Please onboard first.' }, 400)
    }

    const product = await createProduct({
      merchantId: merchant.id,
      projectId,
      title,
      slug,
      description,
      previewUrl,
      thumbnailUrl,
    })

    const productPrice = await createProductPrice({
      productId: product.id!,
      code: price.code,
      amount: price.amount,
      currency: price.currency,
    })

    return c.json({ ...product, prices: [productPrice] }, 201)
  }
)

// GET /products/:id - Get product with prices and merchant name
marketplace.get(
  '/products/:id',
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param')
    const product = await getProductWithMerchant(id)

    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }

    const prices = await getActivePricesByProductId(id)
    return c.json({ ...product, prices })
  }
)

// PATCH /products/:id - Update product
marketplace.patch(
  '/products/:id',
  requireAuth,
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    previewUrl: z.string().url().nullable().optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
  })),
  async (c) => {
    const user = c.get('user')!
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const product = await getProductById(id)
    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }

    // Verify ownership
    const merchant = await getMerchant(user.id)
    if (!merchant || merchant.id !== product.merchantId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const updated = await updateProduct(id, body)
    if (!updated) {
      return c.json({ error: 'No changes' }, 400)
    }

    const prices = await getActivePricesByProductId(id)
    return c.json({ ...updated, prices })
  }
)

// POST /products/:id/prices - Add new price tier
marketplace.post(
  '/products/:id/prices',
  requireAuth,
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', z.object({
    code: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3),
  })),
  async (c) => {
    const user = c.get('user')!
    const { id } = c.req.valid('param')
    const { code, amount, currency } = c.req.valid('json')

    const product = await getProductById(id)
    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }

    // Verify ownership
    const merchant = await getMerchant(user.id)
    if (!merchant || merchant.id !== product.merchantId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const price = await createProductPrice({
      productId: id,
      code,
      amount,
      currency,
    })

    return c.json(price, 201)
  }
)

// POST /checkout - Create order and checkout session
marketplace.post(
  '/checkout',
  requireAuth,
  zValidator('json', z.object({
    productId: z.string().uuid(),
    priceId: z.string().uuid(),
    redirectUrl: z.string().url().optional(),
  })),
  async (c) => {
    const user = c.get('user')!
    const { productId, priceId, redirectUrl } = c.req.valid('json')

    // Get product
    const product = await getProductById(productId)
    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }

    // Get price
    const price = await getPriceById(priceId)
    if (!price || price.productId !== productId || !price.active) {
      return c.json({ error: 'Invalid price' }, 400)
    }

    // Create order
    const order = await createOrder({
      merchantId: product.merchantId,
      customerId: user.id,
      productId,
      priceId,
      amount: price.amount,
      currency: price.currency,
    })

    // Create Whop checkout session
    const whop = getWhopClient(c.env)
    // Whop requires HTTPS redirect URLs - only pass if valid
    const safeRedirectUrl = redirectUrl?.startsWith('https://') ? redirectUrl : undefined
    const checkout = await whop.checkoutConfigurations.create({
      plan: {
        company_id: c.env.PLATFORM_COMPANY_ID,
        currency: order.currency.toLowerCase() as Whop.Currency,
        initial_price: order.amount,
        plan_type: 'one_time',
        title: product.title,
        description: product.description,
      },
      metadata: { orderId: order.id! },
      redirect_url: safeRedirectUrl,
    })

    return c.json({
      orderId: order.id,
      checkoutId: checkout.id,
      purchaseUrl: checkout.purchase_url,
    })
  }
)

export default marketplace
