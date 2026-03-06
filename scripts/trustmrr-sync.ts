import { createDb } from '../packages/db'

const API_BASE = 'https://trustmrr.com/api/v1'
const API_KEY = process.env.TRUSTMRR_API_KEY

if (!API_KEY) {
  console.error('TRUSTMRR_API_KEY is not set')
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const db = createDb(dbUrl, process.env.POSTGRES_TYPE ?? 'pg')

interface TrustMrrStartup {
  name: string
  slug: string
  icon: string | null
  description: string | null
  website: string | null
  country: string | null
  foundedDate: string | null
  category: string | null
  paymentProvider: string
  targetAudience: string | null
  revenue: {
    last30Days: number
    mrr: number
    total: number
  }
  customers: number
  activeSubscriptions: number
  askingPrice: number | null
  profitMarginLast30Days: number | null
  growth30d: number | null
  multiple: number | null
  onSale: boolean
  firstListedForSaleAt: string | null
  xHandle: string | null
}

async function fetchAllStartups(): Promise<TrustMrrStartup[]> {
  const allStartups: TrustMrrStartup[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    console.log(`Fetching page ${page}...`)

    const res = await fetch(`${API_BASE}/startups?page=${page}&limit=50`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })

    if (!res.ok) {
      if (res.status === 429) {
        const resetAt = res.headers.get('X-RateLimit-Reset')
        const waitMs = resetAt ? Math.max(Number(resetAt) * 1000 - Date.now(), 3000) : 60_000
        console.log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw new Error(`API error ${res.status}: ${await res.text()}`)
    }

    const { data, meta } = (await res.json()) as {
      data: TrustMrrStartup[]
      meta: { total: number; page: number; limit: number; hasMore: boolean }
    }

    allStartups.push(...data)
    hasMore = meta.hasMore
    page++

    const remaining = Number(res.headers.get('X-RateLimit-Remaining') ?? 20)
    if (remaining < 3) {
      console.log('Approaching rate limit, pausing 5s...')
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  return allStartups
}

async function syncToDb(startups: TrustMrrStartup[]) {
  const now = new Date()
  let upserted = 0

  for (const s of startups) {
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

  return upserted
}

async function main() {
  console.log('Starting TrustMRR sync...')

  const startups = await fetchAllStartups()
  console.log(`Fetched ${startups.length} startups from API`)

  const count = await syncToDb(startups)
  console.log(`Upserted ${count} startups to database`)

  await db.destroy()
  console.log('Sync complete!')
}

main().catch((err) => {
  console.error('Sync failed:', err)
  process.exit(1)
})
