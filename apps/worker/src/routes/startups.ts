import { Hono } from 'hono'
import { sql } from 'kysely'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { requireAdmin } from '@/middleware/admin'

const startups = new Hono<AppContext>()

startups.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  const perPage = Math.min(Math.max(1, Number(c.req.query('perPage')) || 100), 200)
  const sort = c.req.query('sort') || 'revenue-desc'
  const category = c.req.query('category') || null
  const onSale = c.req.query('onSale')
  const search = c.req.query('search') || null
  const minRevenue = c.req.query('minRevenue') ? Number(c.req.query('minRevenue')) : null
  const maxRevenue = c.req.query('maxRevenue') ? Number(c.req.query('maxRevenue')) : null
  const offset = (page - 1) * perPage

  const applyFilters = (qb: any) => {
    let q = qb
      .where('icon', 'is not', null)
      .where(sql`name NOT ILIKE 'anonymous startup%'`)
      .where(sql`name NOT ILIKE 'hidden business%'`)
      .where(sql`name NOT ILIKE 'confidential startup%'`)
      .where(sql`name NOT ILIKE 'private venture%'`)
      .where(sql`slug NOT LIKE 'hidden-%'`)
      .where(sql`slug NOT LIKE 'stealth-%'`)
      .where(sql`slug NOT LIKE 'unnamed-%'`)
      .where(sql`slug NOT LIKE 'anonymous-%'`)
      .where(sql`slug NOT LIKE 'anon-%'`)
      .where(sql`slug != 'anon'`)
      .where(sql`slug NOT LIKE 'fast-scaling-%'`)
    if (category) q = q.where('category', '=', category)
    if (onSale === 'true') q = q.where('onSale', '=', true)
    else if (onSale === 'false') q = q.where('onSale', '=', false)
    if (minRevenue != null) q = q.where(sql`"revenueLast30Days" >= ${minRevenue}`)
    if (maxRevenue != null) q = q.where(sql`"revenueLast30Days" <= ${maxRevenue}`)
    if (search) {
      const pattern = `%${search}%`
      q = q.where(
        sql`(name ILIKE ${pattern} OR description ILIKE ${pattern} OR "xHandle" ILIKE ${pattern})`,
      )
    }
    return q
  }

  const [totalResult, rows] = await Promise.all([
    applyFilters(db.selectFrom('trustmrr_startup'))
      .select(({ fn }: any) => fn.countAll().as('count'))
      .executeTakeFirst(),
    applyFilters(db.selectFrom('trustmrr_startup').selectAll())
      .$call((qb: any) => {
        switch (sort) {
          case 'revenue-asc':
            return qb.orderBy('revenueLast30Days', 'asc')
          case 'price-desc':
            return qb.orderBy('askingPrice', 'desc')
          case 'price-asc':
            return qb.orderBy('askingPrice', 'asc')
          case 'growth-desc':
            return qb.orderBy('growth30d', 'desc')
          case 'growth-asc':
            return qb.orderBy('growth30d', 'asc')
          case 'customers-desc':
            return qb.orderBy('customers', 'desc')
          case 'mrr-desc':
            return qb.orderBy('revenueMrr', 'desc')
          default:
            return qb.orderBy('revenueLast30Days', 'desc')
        }
      })
      .limit(perPage)
      .offset(offset)
      .execute(),
  ])

  const total = Number(totalResult?.count ?? 0)

  return c.json({
    startups: rows,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  })
})

startups.get('/categories', async (c) => {
  const rows = await db
    .selectFrom('trustmrr_startup')
    .select(['category', ({ fn }) => fn.countAll().as('count')])
    .where('category', 'is not', null)
    .where('icon', 'is not', null)
    .where(sql`name NOT ILIKE 'anonymous startup%'`)
    .where(sql`name NOT ILIKE 'hidden business%'`)
    .where(sql`name NOT ILIKE 'confidential startup%'`)
    .where(sql`name NOT ILIKE 'private venture%'`)
    .where(sql`slug NOT LIKE 'hidden-%'`)
    .where(sql`slug NOT LIKE 'stealth-%'`)
    .where(sql`slug NOT LIKE 'unnamed-%'`)
    .where(sql`slug NOT LIKE 'anonymous-%'`)
    .where(sql`slug NOT LIKE 'anon-%'`)
    .where(sql`slug != 'anon'`)
    .where(sql`slug NOT LIKE 'fast-scaling-%'`)
    .groupBy('category')
    .orderBy('count', 'desc')
    .execute()

  return c.json(rows)
})

startups.post('/sync', requireAdmin, async (c) => {
  const apiKey = process.env.TRUSTMRR_API_KEY
  if (!apiKey) return c.json({ error: 'TRUSTMRR_API_KEY not configured' }, 500)

  const allStartups: any[] = []
  let page = 1
  let hasMore = true
  let rateLimitRetries = 0
  const MAX_RATE_LIMIT_RETRIES = 10

  while (hasMore) {
    const res = await fetch(`https://trustmrr.com/api/v1/startups?page=${page}&limit=50`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (res.status === 429) {
      rateLimitRetries++
      if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
        return c.json(
          { error: 'Rate limit exceeded after max retries', fetched: allStartups.length },
          429,
        )
      }
      const resetAt = res.headers.get('X-RateLimit-Reset')
      const parsed = Number(resetAt)
      const waitMs = !Number.isNaN(parsed) ? Math.max(parsed * 1000 - Date.now(), 3000) : 60_000
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    if (!res.ok) return c.json({ error: `API error ${res.status}` }, 500)

    const { data, meta } = await res.json()
    allStartups.push(...data)
    hasMore = meta.hasMore
    page++

    const remaining = Number(res.headers.get('X-RateLimit-Remaining') ?? 20)
    if (remaining < 3) await new Promise((r) => setTimeout(r, 5000))
  }

  const now = new Date()
  let upserted = 0
  for (const s of allStartups) {
    const row = {
      slug: s.slug,
      name: s.name,
      icon: s.icon,
      description: s.description,
      website: s.website,
      country: s.country,
      foundedDate: s.foundedDate ? new Date(s.foundedDate) : null,
      category: s.category,
      paymentProvider: s.paymentProvider,
      targetAudience: s.targetAudience,
      revenueLast30Days: Math.round(s.revenue.last30Days),
      revenueMrr: Math.round(s.revenue.mrr),
      revenueTotal: Math.round(s.revenue.total),
      customers: s.customers,
      activeSubscriptions: s.activeSubscriptions,
      askingPrice: s.askingPrice != null ? Math.round(s.askingPrice) : null,
      profitMarginLast30Days: s.profitMarginLast30Days,
      growth30d: s.growth30d,
      multiple: s.multiple,
      onSale: s.onSale,
      firstListedForSaleAt: s.firstListedForSaleAt ? new Date(s.firstListedForSaleAt) : null,
      xHandle: s.xHandle,
      syncedAt: now,
      updatedAt: now,
    }

    await db
      .insertInto('trustmrr_startup')
      .values({ ...row, createdAt: now })
      .onConflict((oc) => oc.column('slug').doUpdateSet(row))
      .execute()

    upserted++
  }

  return c.json({ fetched: allStartups.length, upserted, syncedAt: now.toISOString() })
})

startups.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const row = await db
    .selectFrom('trustmrr_startup')
    .selectAll()
    .where('slug', '=', slug)
    .executeTakeFirst()

  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

export default startups
