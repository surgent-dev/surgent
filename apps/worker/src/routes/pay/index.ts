import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sql } from 'kysely'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import type { AppContext } from '@/types/application'
import type { PayEnv } from '@/lib/pay/types'

import {
  projectPathSchema,
  checkoutPathSchema,
  accountPathSchema,
  productPathSchema,
  checkoutProcessorPathSchema,
  customerPathSchema,
  webhookProcessorPathSchema,
  projectQuerySchema,
  projectListQuerySchema,
  listQuerySchema,
  accountListQuerySchema,
  connectBodySchema,
  connectWhopQuerySchema,
  checkoutBodySchema,
  createProductBodySchema,
  updateProductBodySchema,
  createPriceBodySchema,
  checkBodySchema,
  accountQuerySchema,
  payoutsLinkQuerySchema,
  subscriptionPathSchema,
  userAccountsQuerySchema,
} from './schemas'

import { authorizeRequest, authorizeProjectRequest, resolveProjectScope } from './auth'
import {
  requiredId,
  metadataText,
  toMinorAmount,
  toDate,
  normalizeSlug,
  normalizeAccountStatus,
  isSubscriptionActive,
  getClient,
  getAccountForUser,
  resolveActiveAccountId,
  getProductsWithPrices,
  resolveCheckoutStatus,
  resolveBillingPeriod,
} from '@/lib/pay/utils'
import {
  mapLegacyAccount,
  mapLegacySubscription,
  mapLegacyTransaction,
  toLegacyTransactionType,
} from '@/lib/pay/mappers'
import { coerceEvent, verifySignature } from './handlers'
import { enqueueWebhookJob } from '@/lib/pay/queue'

const pay = new Hono<AppContext>()

// --- Health ---

pay.get('/health', (c) => c.json({ ok: true }))

// --- Projects ---

pay.get('/projects', async (c) => {
  const auth = await authorizeRequest(c)

  if (auth.mode === 'api_key' && auth.projectId) {
    const project = await db
      .selectFrom('project')
      .select(['id', 'organizationId', 'name', 'slug'])
      .where('id', '=', auth.projectId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()

    return c.json({
      projects: project
        ? [
            {
              id: project.id,
              organizationId: project.organizationId,
              name: project.name,
              slug: project.slug,
            },
          ]
        : [],
    })
  }

  const rows = await db
    .selectFrom('project')
    .innerJoin('member', 'member.organizationId', 'project.organizationId')
    .select(['project.id', 'project.organizationId', 'project.name', 'project.slug'])
    .where('member.userId', '=', auth.userId)
    .where('project.deletedAt', 'is', null)
    .orderBy('project.createdAt', 'desc')
    .execute()

  return c.json({
    projects: rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      slug: r.slug,
    })),
  })
})

// --- Products ---

pay.get('/products', zValidator('query', projectQuerySchema), async (c) => {
  const { projectId, auth } = await resolveProjectScope(c, c.req.valid('query').projectId)
  const accountId = await resolveActiveAccountId(projectId, auth.env)
  const { products, pricesByProduct } = await getProductsWithPrices(projectId, auth.env, accountId)

  if (!products.length) return c.json([])

  return c.json(
    products.map((product) => {
      const id = requiredId(product.id, 'product')
      return {
        product: {
          id,
          productGroup: product.productGroup,
          name: product.name,
          slug: product.slug,
          projectId: product.projectId,
          accountId: product.accountId,
          description: product.description,
          version: product.version,
          isArchived: product.isArchived,
          isDefault: product.isDefault,
          processorProductId: product.processorProductId,
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
    }),
  )
})

pay.post(
  '/product',
  zValidator('query', projectQuerySchema),
  zValidator('json', createProductBodySchema),
  async (c) => {
    const { projectId, auth } = await resolveProjectScope(c, c.req.valid('query').projectId)
    const body = c.req.valid('json')
    const accountId = await resolveActiveAccountId(projectId, auth.env)

    const slug = normalizeSlug(body.slug)
    if (!slug) return c.json({ error: 'Invalid slug' }, 400)

    const existingSlug = await db
      .selectFrom('product')
      .select('id')
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where('slug', '=', slug)
      .executeTakeFirst()
    if (existingSlug)
      return c.json({ error: 'Product with this slug already exists in project' }, 409)

    const result = await db.transaction().execute(async (trx) => {
      const versions = await trx
        .selectFrom('product')
        .select('version')
        .where('projectId', '=', projectId)
        .where('env', '=', auth.env)
        .where('productGroup', '=', body.productGroup)
        .forUpdate()
        .execute()
      const version = versions.reduce((max, r) => Math.max(max, r.version || 0), 0) + 1
      const now = new Date()

      const inserted = await trx
        .insertInto('product')
        .values({
          productGroup: body.productGroup,
          projectId,
          accountId,
          name: body.name,
          description: body.description || null,
          slug,
          version,
          isDefault: body.isDefault || false,
          isArchived: false,
          processor: 'whop',
          env: auth.env,
          createdAt: now,
          updatedAt: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      return {
        productId: requiredId(inserted.id, 'product'),
        productGroup: body.productGroup,
        version,
      }
    })

    return c.json(result, 201)
  },
)

pay.put(
  '/product/:id',
  zValidator('param', productPathSchema),
  zValidator('json', updateProductBodySchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const auth = await authorizeRequest(c)

    const existing = await db
      .selectFrom('product')
      .selectAll()
      .where('id', '=', id)
      .where('env', '=', auth.env)
      .executeTakeFirst()
    if (!existing) return c.json({ error: 'Product not found' }, 404)

    await authorizeProjectRequest(c, existing.projectId, auth)
    const metadataOnly =
      body.name === undefined && body.description === undefined && body.slug === undefined

    if (metadataOnly) {
      await db
        .updateTable('product')
        .set({
          isArchived: body.isArchived ?? existing.isArchived,
          isDefault: body.isDefault ?? existing.isDefault,
          updatedAt: new Date(),
        })
        .where('id', '=', id)
        .where('env', '=', existing.env)
        .execute()

      return c.json({
        productId: requiredId(existing.id, 'product'),
        productGroup: existing.productGroup,
        version: existing.version || 1,
      })
    }

    const result = await db.transaction().execute(async (trx) => {
      let versionsQuery = trx
        .selectFrom('product')
        .select('version')
        .where('projectId', '=', existing.projectId)
        .where('env', '=', existing.env)
        .where('productGroup', '=', existing.productGroup)
      if (existing.accountId) {
        versionsQuery = versionsQuery.where((eb) =>
          eb.or([eb('accountId', '=', existing.accountId!), eb('accountId', 'is', null)]),
        )
      }
      const versions = await versionsQuery.forUpdate().execute()
      const version = versions.reduce((max, r) => Math.max(max, r.version || 0), 0) + 1
      const newSlug = body.slug
        ? normalizeSlug(body.slug)
        : normalizeSlug(`${existing.slug}-v${version}`)
      if (!newSlug) return { error: 'Invalid slug' as const }

      let slugConflictQuery = trx
        .selectFrom('product')
        .select('id')
        .where('projectId', '=', existing.projectId)
        .where('env', '=', existing.env)
        .where('slug', '=', newSlug)
      if (existing.accountId) {
        slugConflictQuery = slugConflictQuery.where((eb) =>
          eb.or([eb('accountId', '=', existing.accountId!), eb('accountId', 'is', null)]),
        )
      }
      const slugConflict = await slugConflictQuery.executeTakeFirst()
      if (slugConflict) return { error: 'slug_conflict' as const }

      const now = new Date()
      const inserted = await trx
        .insertInto('product')
        .values({
          productGroup: existing.productGroup,
          projectId: existing.projectId,
          accountId: existing.accountId,
          name: body.name ?? existing.name,
          description: body.description !== undefined ? body.description : existing.description,
          slug: newSlug,
          version,
          isDefault: body.isDefault ?? existing.isDefault,
          isArchived: body.isArchived ?? existing.isArchived,
          processor: existing.processor || 'whop',
          processorProductId: existing.processorProductId,
          isAddOn: existing.isAddOn,
          planGroup: existing.planGroup,
          env: existing.env,
          createdAt: now,
          updatedAt: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      return {
        productId: requiredId(inserted.id, 'product'),
        productGroup: existing.productGroup,
        version,
      }
    })

    if ('error' in result) {
      if (result.error === 'slug_conflict')
        return c.json({ error: 'Product with this slug already exists in project' }, 409)
      return c.json({ error: result.error }, 400)
    }
    return c.json(result, 201)
  },
)

pay.post(
  '/product/price',
  zValidator('query', projectQuerySchema),
  zValidator('json', createPriceBodySchema),
  async (c) => {
    const { projectId, auth } = await resolveProjectScope(c, c.req.valid('query').projectId)
    const body = c.req.valid('json')
    const accountId = await resolveActiveAccountId(projectId, auth.env)

    let productQuery = db
      .selectFrom('product')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where('productGroup', '=', body.productGroup)
    if (accountId) {
      productQuery = productQuery.where((eb) =>
        eb.or([eb('accountId', '=', accountId), eb('accountId', 'is', null)]),
      )
    }
    const productRows = await productQuery
      .orderBy('version', 'desc')
      .orderBy('createdAt', 'desc')
      .execute()
    if (!productRows.length) return c.json({ error: 'Invalid product' }, 403)

    const product = productRows[0]
    const pid = requiredId(product.id, 'product')

    const existingPrice = await db
      .selectFrom('product_price')
      .select('recurringInterval')
      .where('productId', '=', pid)
      .executeTakeFirst()

    if (existingPrice?.recurringInterval && !body.recurringInterval) {
      return c.json(
        { error: 'Cannot add one-time price to product with existing subscription prices' },
        400,
      )
    }
    if (!existingPrice?.recurringInterval && body.recurringInterval && existingPrice) {
      return c.json(
        { error: 'Cannot add subscription price to product with existing one-time prices' },
        400,
      )
    }

    const slug = body.slug ? normalizeSlug(body.slug) : null
    if (body.slug && !slug) return c.json({ error: 'Invalid price slug' }, 400)

    if (slug) {
      const existingSlug = await db
        .selectFrom('product_price')
        .select('id')
        .where('productId', '=', pid)
        .where('slug', '=', slug)
        .executeTakeFirst()
      if (existingSlug)
        return c.json({ error: 'Price with this slug already exists for product' }, 409)
    }

    const inserted = await db
      .insertInto('product_price')
      .values({
        productId: pid,
        name: body.name || null,
        description: body.description || null,
        slug,
        priceAmount: body.price,
        priceCurrency: body.priceCurrency.toLowerCase(),
        recurringInterval: body.recurringInterval || null,
        isDefault: body.isDefault || false,
        processor: 'whop',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    return c.json({ productPriceId: requiredId(inserted.id, 'product price') }, 201)
  },
)

// --- Access check ---

pay.post(
  '/check',
  zValidator('query', projectQuerySchema),
  zValidator('json', checkBodySchema),
  async (c) => {
    const { projectId, auth } = await resolveProjectScope(c, c.req.valid('query').projectId)
    const body = c.req.valid('json')

    // Resolve customer by pay_customer.id or Whop externalId
    const customer = await db
      .selectFrom('pay_customer')
      .select('id')
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where((eb) =>
        eb.or([eb('id', '=', body.customerId), eb('externalId', '=', body.customerId)]),
      )
      .executeTakeFirst()

    if (!customer) return c.json({ allowed: false })

    const subscription = await db
      .selectFrom('pay_subscription')
      .select(['id', 'status'])
      .where('customerId', '=', customer.id)
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where('whopProductId', '=', body.productId)
      .orderBy('updatedAt', 'desc')
      .executeTakeFirst()

    if (subscription && isSubscriptionActive(subscription.status)) {
      return c.json({ allowed: true })
    }

    const payment = await db
      .selectFrom('pay_payment')
      .select('id')
      .where('customerId', '=', customer.id)
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where('status', '=', 'succeeded')
      .where(
        sql<boolean>`
          ("metadata" @> jsonb_build_object('product_id', ${body.productId}))
          OR ("metadata" @> jsonb_build_object('productId', ${body.productId}))
        `,
      )
      .executeTakeFirst()

    return c.json({ allowed: Boolean(payment) })
  },
)

// --- Accounts ---

pay.post(
  '/accounts/connect/whop',
  zValidator('query', connectWhopQuerySchema),
  zValidator('json', connectBodySchema),
  async (c) => {
    const query = c.req.valid('query')
    const body = c.req.valid('json')
    const auth = await authorizeRequest(c)
    const userId = auth.userId
    const now = new Date()

    // Check if user already has an active account for this env
    const existing = await db
      .selectFrom('pay_account')
      .selectAll()
      .where('userId', '=', userId)
      .where('env', '=', auth.env)
      .where('status', '!=', 'disconnected')
      .executeTakeFirst()

    if (existing) {
      return c.json({
        accountId: requiredId(existing.id, 'account'),
        processorAccountId: existing.whopCompanyId,
        status: normalizeAccountStatus(existing.status),
        id: existing.id,
        companyId: existing.whopCompanyId,
        title: existing.title,
      })
    }

    // Reconnect a disconnected account
    if (query.accountId) {
      const reconnected = await db
        .updateTable('pay_account')
        .set({ status: 'connected', updatedAt: now })
        .where('id', '=', query.accountId)
        .where('userId', '=', userId)
        .where('env', '=', auth.env)
        .returningAll()
        .executeTakeFirst()

      if (!reconnected) return c.json({ error: 'Account not found' }, 404)

      return c.json({
        accountId: requiredId(reconnected.id, 'account'),
        processorAccountId: reconnected.whopCompanyId,
        status: normalizeAccountStatus(reconnected.status),
        id: reconnected.id,
        companyId: reconnected.whopCompanyId,
        title: reconnected.title,
      })
    }

    // Create new Whop company and account
    const companyTitle = body.title || body.companyName
    if (!companyTitle) return c.json({ error: 'title or companyName is required' }, 400)

    const projectId = body.projectId || query.projectId || auth.projectId
    const client = getClient(auth.env)
    const company = await client.createCompany({
      title: companyTitle,
      email: body.email,
      metadata: {
        internal_user_id: userId,
        project_id: projectId || null,
        country: (body.country || 'us').toLowerCase(),
        business_type: body.businessType || null,
      },
    })

    const accountMeta = {
      email: body.email || null,
      title: company.title,
      country: (body.country || 'us').toLowerCase(),
      businessType: body.businessType || null,
    }

    const account = await db
      .insertInto('pay_account')
      .values({
        userId,
        whopCompanyId: company.id,
        title: company.title,
        status: 'connected',
        metadata: accountMeta,
        env: auth.env,
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((oc) =>
        oc.columns(['userId', 'env']).doUpdateSet({
          whopCompanyId: company.id,
          title: company.title,
          status: 'connected',
          metadata: accountMeta,
          updatedAt: now,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow()

    return c.json({
      accountId: requiredId(account.id, 'account'),
      processorAccountId: account.whopCompanyId,
      status: normalizeAccountStatus(account.status),
      id: account.id,
      companyId: account.whopCompanyId,
      title: account.title,
    })
  },
)

pay.get('/accounts', zValidator('query', accountListQuerySchema), async (c) => {
  const auth = await authorizeRequest(c)
  const query = c.req.valid('query')
  if (query.processor && query.processor !== 'whop') return c.json([])

  const rows = await db
    .selectFrom('pay_account')
    .selectAll()
    .where('userId', '=', auth.userId)
    .where('env', '=', auth.env)
    .orderBy('createdAt', 'desc')
    .execute()

  return c.json(rows.map(mapLegacyAccount))
})

pay.get('/accounts/user', zValidator('query', userAccountsQuerySchema), async (c) => {
  const auth = await authorizeRequest(c)
  if (c.req.valid('query').processor && c.req.valid('query').processor !== 'whop') return c.json([])

  const rows = await db
    .selectFrom('pay_account')
    .selectAll()
    .where('userId', '=', auth.userId)
    .where('env', '=', auth.env)
    .orderBy('createdAt', 'desc')
    .execute()

  return c.json(
    rows.map((row) => ({
      id: requiredId(row.id, 'account'),
      processor: 'whop',
      processorAccountId: row.whopCompanyId,
      status: normalizeAccountStatus(row.status),
      email: metadataText(row.metadata, 'email'),
      title: row.title || metadataText(row.metadata, 'title'),
      country: metadataText(row.metadata, 'country'),
    })),
  )
})

pay.get('/accounts/whop/token', zValidator('query', accountQuerySchema), async (c) => {
  const auth = await authorizeRequest(c)
  const query = c.req.valid('query')
  const accountId = query.accountId || query.account_id
  const projectId =
    auth.mode === 'api_key' ? query.projectId || auth.projectId || undefined : query.projectId
  if (projectId) await authorizeProjectRequest(c, projectId)

  const account = await getAccountForUser({ userId: auth.userId, accountId, env: auth.env })

  const client = getClient(auth.env)
  const token = await client.createAccessToken(account.whopCompanyId)

  return c.json({ token, companyId: account.whopCompanyId, accountId: account.id })
})

pay.get('/accounts/whop/payouts-link', zValidator('query', payoutsLinkQuerySchema), async (c) => {
  const auth = await authorizeRequest(c)
  const query = c.req.valid('query')
  const accountId = query.accountId || query.account_id

  const account = await getAccountForUser({ userId: auth.userId, accountId, env: auth.env })

  const base = query.redirectBaseUrl || config.whop.redirectBaseUrl || config.server.clientOrigin
  const returnUrl = query.returnUrl || `${base}/dashboard/payments`
  const refreshUrl = query.refreshUrl || returnUrl

  const client = getClient(auth.env)
  const url = await client.createAccountLink({
    company_id: account.whopCompanyId,
    use_case: 'payouts_portal',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  })

  return c.json({ url, companyId: account.whopCompanyId })
})

pay.get('/accounts/:id', zValidator('param', accountPathSchema), async (c) => {
  const auth = await authorizeRequest(c)
  const row = await db
    .selectFrom('pay_account')
    .selectAll()
    .where('id', '=', c.req.valid('param').id)
    .where('userId', '=', auth.userId)
    .where('env', '=', auth.env)
    .executeTakeFirst()

  if (!row) return c.json({ error: 'Account not found' }, 404)
  return c.json(mapLegacyAccount(row))
})

pay.delete('/accounts/:id', zValidator('param', accountPathSchema), async (c) => {
  const auth = await authorizeRequest(c)
  const { id } = c.req.valid('param')

  const exists = await db
    .selectFrom('pay_account')
    .select('id')
    .where('id', '=', id)
    .where('userId', '=', auth.userId)
    .where('env', '=', auth.env)
    .executeTakeFirst()
  if (!exists) return c.json({ error: 'Account not found' }, 404)

  await db
    .updateTable('pay_account')
    .set({ status: 'disconnected', updatedAt: new Date() })
    .where('id', '=', id)
    .where('userId', '=', auth.userId)
    .where('env', '=', auth.env)
    .execute()

  return c.json({ disconnected: true })
})

// --- Checkout ---

pay.post('/checkout', zValidator('json', checkoutBodySchema), async (c) => {
  const body = c.req.valid('json')
  const auth = await authorizeProjectRequest(c, body.projectId)

  // Idempotency: return existing successful checkout, clear retriable ones
  if (body.idempotencyKey) {
    const existing = await db
      .selectFrom('pay_checkout_session')
      .select(['id', 'whopCheckoutId', 'purchaseUrl', 'status', 'createdAt'])
      .where('projectId', '=', body.projectId)
      .where('env', '=', auth.env)
      .where('idempotencyKey', '=', body.idempotencyKey)
      .executeTakeFirst()

    if (existing) {
      const staleCreating =
        existing.status === 'creating' && Date.now() - (existing.createdAt?.getTime() ?? 0) > 60_000

      if (existing.status !== 'failed' && !staleCreating) {
        return c.json({
          id: existing.id,
          sessionId: existing.whopCheckoutId,
          purchaseUrl: existing.purchaseUrl,
          status: existing.status,
        })
      }

      // Failed or stale — clear so the insert below can claim the slot
      await db.deleteFrom('pay_checkout_session').where('id', '=', existing.id).execute()
    }
  }

  // Resolve pricing from DB when priceId is provided
  let title = body.title || 'Payment'
  let amountCents = body.amount || 0
  let currency = body.currency
  let planType = body.planType
  let productId = body.productId
  let recurringInterval: string | null = null

  if (body.priceId) {
    const price = await db
      .selectFrom('product_price')
      .selectAll()
      .where('id', '=', body.priceId)
      .executeTakeFirst()
    if (!price) return c.json({ error: 'Price not found' }, 404)

    const product = await db
      .selectFrom('product')
      .select(['id', 'name', 'projectId', 'isArchived'])
      .where('id', '=', price.productId)
      .where('env', '=', auth.env)
      .executeTakeFirst()
    if (!product) return c.json({ error: 'Product not found' }, 404)
    if (product.isArchived) return c.json({ error: 'Product is archived' }, 400)
    if (product.projectId !== body.projectId) {
      return c.json({ error: 'Price does not belong to this project' }, 403)
    }

    amountCents = price.priceAmount
    currency = price.priceCurrency
    title = product.name || title
    planType = price.recurringInterval ? 'renewal' : 'one_time'
    recurringInterval = price.recurringInterval
    productId = product.id || undefined
  }

  const account = await getAccountForUser({
    userId: auth.userId,
    accountId: body.accountId,
    env: auth.env,
  })
  const companyId = account.whopCompanyId
  const checkoutId = crypto.randomUUID()
  const now = new Date()
  const amount = amountCents / 100
  const fee = body.applicationFeeAmount !== undefined ? body.applicationFeeAmount / 100 : undefined
  const billingPeriod = resolveBillingPeriod(recurringInterval, body.billingPeriod)
  const callerRedirectUrl =
    body.redirectUrl && /^https?:\/\//i.test(body.redirectUrl) ? body.redirectUrl : undefined
  const base = config.whop.redirectBaseUrl || config.server.clientOrigin
  const defaultRedirectUrl = `${base}/project/${body.projectId}?tab=payments&checkout=success`
  const safeRedirectUrl = callerRedirectUrl || defaultRedirectUrl
  const metadata = {
    ...(body.metadata || {}),
    session_id: checkoutId,
    project_id: body.projectId,
    title,
    ...(productId ? { product_id: productId } : {}),
    ...(body.customerId ? { customer_id: body.customerId } : {}),
    redirect_url: safeRedirectUrl,
  }

  // Reserve slot — ON CONFLICT handles the race between concurrent delete+insert
  const reserved = await db
    .insertInto('pay_checkout_session')
    .values({
      id: checkoutId,
      projectId: body.projectId,
      userId: auth.userId,
      accountId: account.id,
      env: auth.env,
      whopCompanyId: companyId,
      whopCheckoutId: null,
      purchaseUrl: null,
      mode: 'payment',
      planType: planType,
      status: 'creating',
      amount: amountCents,
      currency: currency.toLowerCase(),
      idempotencyKey: body.idempotencyKey || null,
      metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) => oc.columns(['projectId', 'idempotencyKey', 'env']).doNothing())
    .returning('id')
    .executeTakeFirst()

  if (!reserved && body.idempotencyKey) {
    // Another request won the race — return their row
    const winner = await db
      .selectFrom('pay_checkout_session')
      .select(['id', 'whopCheckoutId', 'purchaseUrl', 'status'])
      .where('projectId', '=', body.projectId)
      .where('env', '=', auth.env)
      .where('idempotencyKey', '=', body.idempotencyKey)
      .executeTakeFirst()
    if (winner) {
      return c.json({
        id: winner.id,
        sessionId: winner.whopCheckoutId,
        purchaseUrl: winner.purchaseUrl,
        status: winner.status,
      })
    }

    return c.json({ error: 'Checkout request conflict, retry shortly' }, 409)
  }

  const plan =
    planType === 'renewal'
      ? {
          company_id: companyId,
          currency: currency.toLowerCase(),
          plan_type: 'renewal' as const,
          renewal_price: amount,
          billing_period: billingPeriod,
          application_fee_amount: fee,
          product: { title, external_identifier: productId || 'unknown' },
        }
      : {
          company_id: companyId,
          currency: currency.toLowerCase(),
          plan_type: 'one_time' as const,
          initial_price: amount,
          application_fee_amount: fee,
          title,
        }

  const client = getClient(auth.env)
  let checkout: { id: string; purchase_url?: string }
  try {
    checkout = await client.createCheckoutConfiguration({
      mode: 'payment',
      plan,
      redirect_url: safeRedirectUrl,
      metadata,
    })
  } catch (err) {
    await db
      .updateTable('pay_checkout_session')
      .set({ status: 'failed', updatedAt: new Date() })
      .where('id', '=', checkoutId)
      .execute()
    throw err
  }

  await db
    .updateTable('pay_checkout_session')
    .set({
      whopCheckoutId: checkout.id,
      purchaseUrl: checkout.purchase_url || null,
      status: 'open',
      updatedAt: new Date(),
    })
    .where('id', '=', checkoutId)
    .execute()

  return c.json({
    id: checkoutId,
    sessionId: checkout.id,
    purchaseUrl: checkout.purchase_url || null,
    status: 'open',
  })
})

pay.get('/checkout/:id', zValidator('param', checkoutPathSchema), async (c) => {
  const { id } = c.req.valid('param')
  const row = await db
    .selectFrom('pay_checkout_session')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!row) return c.json({ error: 'Checkout not found' }, 404)

  // Public endpoint — UUID is unguessable, no auth needed (same pattern as Stripe hosted checkout)
  const isTerminal = ['completed', 'failed'].includes(row.status)
  const client = getClient(row.env as PayEnv)
  const remote =
    !isTerminal && row.whopCheckoutId
      ? await client.retrieveCheckoutConfiguration(row.whopCheckoutId).catch(() => null)
      : null
  const nextStatus = resolveCheckoutStatus(row.status, remote?.status || row.status)
  const completedAt = nextStatus === 'completed' ? row.completedAt || new Date() : row.completedAt

  if (nextStatus !== row.status) {
    await db
      .updateTable('pay_checkout_session')
      .set({
        status: nextStatus,
        completedAt,
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .execute()
  }

  const meta = (row.metadata || {}) as Record<string, unknown>

  return c.json({
    id: row.id,
    sessionId: row.whopCheckoutId,
    status: nextStatus,
    amount: row.amount,
    currency: row.currency,
    planType: row.planType,
    title: (meta.title as string) || null,
    redirectUrl: (meta.redirect_url as string) || null,
    env: row.env,
    createdAt: row.createdAt,
    completedAt,
  })
})

pay.get(
  '/checkout/success/:sessionId',
  zValidator('param', checkoutProcessorPathSchema),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    const row = await db
      .selectFrom('pay_checkout_session')
      .select(['metadata', 'projectId'])
      .where('whopCheckoutId', '=', sessionId)
      .executeTakeFirst()
    if (!row) return c.json({ error: 'Checkout session not found' }, 404)

    const redirectUrl = metadataText(row.metadata, 'redirect_url')
    if (redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
      return c.redirect(redirectUrl, 302)
    }

    const base = config.whop.redirectBaseUrl || config.server.clientOrigin
    return c.redirect(`${base}/project/${row.projectId}?tab=payments&checkout=success`, 302)
  },
)

pay.get(
  '/checkout/cancel/:sessionId',
  zValidator('param', checkoutProcessorPathSchema),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    const row = await db
      .selectFrom('pay_checkout_session')
      .select(['metadata', 'projectId'])
      .where('whopCheckoutId', '=', sessionId)
      .executeTakeFirst()
    if (!row) return c.json({ error: 'Checkout session not found' }, 404)

    const redirectUrl = metadataText(row.metadata, 'redirect_url')
    if (redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
      return c.redirect(redirectUrl, 302)
    }

    const base = config.whop.redirectBaseUrl || config.server.clientOrigin
    return c.redirect(`${base}/project/${row.projectId}?tab=payments&checkout=cancel`, 302)
  },
)

// --- Subscriptions ---

pay.get('/subscriptions', zValidator('query', projectListQuerySchema), async (c) => {
  const query = c.req.valid('query')
  const { projectId, auth } = await resolveProjectScope(c, query.projectId)

  const rows = await db
    .selectFrom('pay_subscription')
    .selectAll()
    .where('projectId', '=', projectId)
    .where('env', '=', auth.env)
    .orderBy('createdAt', 'desc')
    .limit(query.limit || 50)
    .execute()

  return c.json(rows.map(mapLegacySubscription))
})

pay.post('/subscriptions/:id/cancel', zValidator('param', subscriptionPathSchema), async (c) => {
  const { id } = c.req.valid('param')
  const auth = await authorizeRequest(c)
  const row = await db
    .selectFrom('pay_subscription')
    .select(['id', 'projectId', 'status', 'whopMembershipId', 'canceledAt'])
    .where('id', '=', id)
    .where('env', '=', auth.env)
    .executeTakeFirst()

  if (!row) return c.json({ error: 'Subscription not found' }, 404)
  if (!row.projectId) return c.json({ error: 'Subscription has no project' }, 400)
  if (!row.whopMembershipId) return c.json({ error: 'Subscription has no processor id' }, 400)
  if (row.status === 'canceled')
    return c.json({ id, status: 'canceled', canceledAt: row.canceledAt })

  await authorizeProjectRequest(c, row.projectId, auth)

  const client = getClient(auth.env)
  const remote = await client.cancelMembership(row.whopMembershipId)
  const now = new Date()
  const status = typeof remote.status === 'string' ? remote.status : 'canceled'
  const canceledAt = toDate(remote.canceled_at) || (status === 'canceled' ? now : null)

  await db
    .updateTable('pay_subscription')
    .set({
      status,
      updatedAt: now,
      ...(canceledAt && { canceledAt }),
      ...(typeof remote.cancel_at_period_end === 'boolean' && {
        cancelAtPeriodEnd: remote.cancel_at_period_end,
      }),
    })
    .where('id', '=', id)
    .execute()

  return c.json({ id, status, canceledAt })
})

// --- Customers ---

pay.get('/customers', zValidator('query', projectListQuerySchema), async (c) => {
  const query = c.req.valid('query')
  const { projectId, auth } = await resolveProjectScope(c, query.projectId)
  const limit = query.limit || 500

  const rows = await db
    .selectFrom('pay_customer')
    .select(['id', 'projectId', 'externalId', 'email', 'name'])
    .where('projectId', '=', projectId)
    .where('env', '=', auth.env)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()

  return c.json(
    rows.map((row) => ({
      id: requiredId(row.id, 'customer'),
      projectId: row.projectId,
      externalId: row.externalId,
      email: row.email,
      name: row.name,
      processorCustomerId: row.externalId,
    })),
  )
})

pay.get(
  '/customers/:id',
  zValidator('param', customerPathSchema),
  zValidator('query', projectQuerySchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { projectId, auth } = await resolveProjectScope(c, c.req.valid('query').projectId)

    const customer = await db
      .selectFrom('pay_customer')
      .select(['id', 'projectId', 'externalId', 'email', 'name'])
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where((eb) =>
        eb.or([
          eb('id', '=', id),
          eb('externalId', '=', id),
          ...(id.includes('@') ? [eb('email', '=', id)] : []),
        ]),
      )
      .orderBy('createdAt', 'desc')
      .executeTakeFirst()

    if (!customer) return c.json({ error: 'Customer not found' }, 404)

    const cid = requiredId(customer.id, 'customer')

    const subscriptions = await db
      .selectFrom('pay_subscription')
      .select(['id', 'status', 'createdAt', 'currentPeriodStart', 'currentPeriodEnd'])
      .where('customerId', '=', cid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .execute()

    const payments = await db
      .selectFrom('pay_payment')
      .select(['id'])
      .where('customerId', '=', cid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .execute()

    const paymentIds = payments
      .map((payment) => payment.id)
      .filter((value): value is string => Boolean(value))
    const subscriptionIds = subscriptions
      .map((subscription) => subscription.id)
      .filter((value): value is string => Boolean(value))
    const transactions = await db
      .selectFrom('pay_transaction')
      .select(['id', 'kind', 'amount', 'currency', 'createdAt', 'metadata'])
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where((eb) => {
        if (paymentIds.length && subscriptionIds.length) {
          return eb.or([
            eb('paymentId', 'in', paymentIds),
            eb('subscriptionId', 'in', subscriptionIds),
          ])
        }
        if (paymentIds.length) return eb('paymentId', 'in', paymentIds)
        if (subscriptionIds.length) return eb('subscriptionId', 'in', subscriptionIds)
        return sql<boolean>`false`
      })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .execute()

    return c.json({
      id: requiredId(customer.id, 'customer'),
      projectId: customer.projectId,
      externalId: customer.externalId,
      email: customer.email,
      name: customer.name,
      processorCustomerId: customer.externalId,
      transactions: transactions.map((r) => ({
        id: requiredId(r.id, 'transaction'),
        createdAt: r.createdAt,
        type: toLegacyTransactionType(r.kind),
        amount: toMinorAmount(r.amount),
        currency: r.currency,
      })),
      subscriptions: subscriptions.map((r) => ({
        id: requiredId(r.id, 'subscription'),
        createdAt: r.createdAt,
        status: r.status,
        currentPeriodStart: r.currentPeriodStart,
        currentPeriodEnd: r.currentPeriodEnd,
      })),
    })
  },
)

// --- Legacy transactions (mapped format) ---

pay.get(
  '/project/:projectId/transactions',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_transaction')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .where('kind', 'in', ['payment', 'processor_fee', 'refund', 'dispute', 'balance', 'payout'])
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()

    // Aggregate processor_fee rows by paymentTransactionId into a single fee per payment
    const feesByPayment = new Map<string, typeof rows>()
    const nonFeeRows: typeof rows = []
    for (const row of rows) {
      if (row.kind === 'processor_fee' && row.paymentTransactionId) {
        const existing = feesByPayment.get(row.paymentTransactionId)
        if (existing) existing.push(row)
        else feesByPayment.set(row.paymentTransactionId, [row])
      } else {
        nonFeeRows.push(row)
      }
    }

    const aggregatedFees = [...feesByPayment.entries()].map(([, fees]) => {
      const total = fees.reduce((sum, f) => sum + Number(f.amount), 0)
      const first = fees[0]
      return { ...first, amount: String(total) }
    })

    const merged = [...nonFeeRows, ...aggregatedFees].sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
    )

    return c.json(merged.map(mapLegacyTransaction))
  },
)

// --- Raw project-scoped entity endpoints ---

pay.get(
  '/projects/:projectId/payments',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_payment')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()
    return c.json(rows)
  },
)

pay.get(
  '/projects/:projectId/subscriptions',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_subscription')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()
    return c.json(rows)
  },
)

pay.get(
  '/projects/:projectId/transactions',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_transaction')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()
    return c.json(rows)
  },
)

pay.get(
  '/projects/:projectId/invoices',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_invoice')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()
    return c.json(rows)
  },
)

pay.get(
  '/projects/:projectId/refunds',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_refund')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()
    return c.json(rows)
  },
)

pay.get(
  '/projects/:projectId/disputes',
  zValidator('param', projectPathSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { projectId } = c.req.valid('param')
    const auth = await authorizeProjectRequest(c, projectId)

    const rows = await db
      .selectFrom('pay_dispute')
      .selectAll()
      .where('projectId', '=', projectId)
      .where('env', '=', auth.env)
      .orderBy('createdAt', 'desc')
      .limit(c.req.valid('query').limit || 50)
      .execute()
    return c.json(rows)
  },
)

// --- Webhooks ---

pay.post(
  '/webhooks/:processor/:env',
  zValidator('param', webhookProcessorPathSchema),
  async (c) => {
    const { processor, env } = c.req.valid('param')
    if (processor !== 'whop') return c.json({ error: 'Unsupported processor' }, 404)

    const body = await c.req.text()
    const verification = verifySignature({
      body,
      env,
      webhookId: c.req.header('webhook-id'),
      webhookTimestamp: c.req.header('webhook-timestamp'),
      webhookSignature: c.req.header('webhook-signature'),
    })
    const tag = `[WEBHOOK:whop:${env}]`

    if (!verification.ok) {
      c.var.logger.warn({ error: verification.error }, `${tag} signature verification failed`)
      return c.json({ error: verification.error }, verification.statusCode)
    }

    const payload = (() => {
      try {
        return JSON.parse(body)
      } catch {
        return null
      }
    })()
    if (!payload || typeof payload !== 'object')
      return c.json({ error: 'Invalid webhook payload' }, 400)

    const parsed = coerceEvent(payload)
    if (!parsed.ok) {
      c.var.logger.warn({ error: parsed.error }, `${tag} event parsing failed`)
      return c.json({ error: parsed.error }, 400)
    }

    const eventId = parsed.value.eventId || verification.value.eventId
    const eventType = parsed.value.eventType
    const now = new Date()

    c.var.logger.info({ eventId }, `${tag} ${eventType} received`)

    const inserted = await db
      .insertInto('pay_webhook_event')
      .values({
        id: eventId,
        eventType,
        env,
        payload: payload as Record<string, unknown>,
        status: 'pending',
        receivedAt: now,
        handledAt: null,
        error: null,
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .returning('id')
      .executeTakeFirst()

    if (!inserted) {
      const existing = await db
        .selectFrom('pay_webhook_event')
        .select(['status'])
        .where('id', '=', eventId)
        .executeTakeFirst()
      if (existing?.status === 'pending' || existing?.status === 'failed') {
        c.var.logger.info({ eventId }, `${tag} duplicate (${existing.status}), re-queuing`)
        await enqueueWebhookJob(eventId, eventType, parsed.value, env)
        return c.json({ ok: true, duplicate: true, queued: true }, 202)
      }
      c.var.logger.info({ eventId }, `${tag} duplicate, already ${existing?.status}`)
      return c.json({ ok: true, duplicate: true })
    }

    await enqueueWebhookJob(eventId, eventType, parsed.value, env)

    c.var.logger.info({ eventId }, `${tag} enqueued → webhook.process`)
    return c.json({ ok: true, queued: true }, 202)
  },
)

export default pay
