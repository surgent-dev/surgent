/**
 * Export paid customers from Autumn API (active, trialing, past_due products)
 * to existing_customers.json for billing migration backfill.
 *
 * Usage:
 *   source apps/worker/.env.local && bun apps/worker/scripts/stripe-export.ts
 */

const autumnKey = process.env.AUTUMN_SECRET_KEY
if (!autumnKey) {
  console.error('AUTUMN_SECRET_KEY is not set')
  process.exit(1)
}

const BASE = 'https://api.useautumn.com/v1'

async function autumnGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${autumnKey}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Autumn ${res.status}: ${text}`)
  }
  return res.json()
}

type AutumnProduct = {
  id: string
  name: string | null
  group: string | null
  status: string
  started_at: number
  canceled_at: number | null
  is_default: boolean
  is_add_on: boolean
  current_period_start: number | null
  current_period_end: number | null
  stripe_subscription_ids: string[] | null
  items: unknown[] | null
  quantity: number
}

type AutumnFeature = {
  id: string
  type: string
  name: string | null
  interval: string | null
  balance: number | null
  usage: number | null
  included_usage: number | null
  next_reset_at: number | null
  unlimited: boolean | null
  overage_allowed: boolean | null
}

type AutumnCustomer = {
  id: string | null
  created_at: number
  name: string | null
  email: string | null
  fingerprint: string | null
  stripe_id: string | null
  env: string
  metadata: Record<string, unknown>
  products: AutumnProduct[]
  features: Record<string, AutumnFeature>
  rewards: { discounts: unknown[] } | null
}

type ExportedCustomer = {
  autumnId: string | null
  stripeCustomerId: string | null
  email: string | null
  name: string | null
  env: string
  metadata: Record<string, unknown>
  products: Array<{
    id: string
    name: string | null
    group: string | null
    status: string
    startedAt: string
    canceledAt: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    stripeSubscriptionIds: string[] | null
    isDefault: boolean
    isAddOn: boolean
  }>
  features: Record<
    string,
    {
      type: string
      balance: number | null
      usage: number | null
      includedUsage: number | null
      nextResetAt: string | null
      unlimited: boolean | null
    }
  >
  discounts: unknown[]
}

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due'])

function ts(ms: number | null | undefined): string | null {
  if (!ms) return null
  return new Date(ms).toISOString()
}

async function run() {
  console.log('Fetching customers from Autumn...\n')

  const allCustomers: ExportedCustomer[] = []
  const PAGE_SIZE = 100
  let offset = 0

  while (true) {
    const page = (await autumnGet(`/customers?limit=${PAGE_SIZE}&offset=${offset}`)) as {
      list: AutumnCustomer[]
      total: number
    }

    console.log(`  page offset=${offset}, got ${page.list.length} of ${page.total} total`)

    for (const cust of page.list) {
      const paidProducts = cust.products.filter(
        (p) => PAID_STATUSES.has(p.status) && p.id !== 'free',
      )
      if (!paidProducts.length) continue

      const exported: ExportedCustomer = {
        autumnId: cust.id,
        stripeCustomerId: cust.stripe_id,
        email: cust.email,
        name: cust.name,
        env: cust.env,
        metadata: cust.metadata ?? {},
        products: paidProducts.map((p) => ({
          id: p.id,
          name: p.name,
          group: p.group,
          status: p.status,
          startedAt: ts(p.started_at) ?? new Date().toISOString(),
          canceledAt: ts(p.canceled_at),
          currentPeriodStart: ts(p.current_period_start),
          currentPeriodEnd: ts(p.current_period_end),
          stripeSubscriptionIds: p.stripe_subscription_ids,
          isDefault: p.is_default,
          isAddOn: p.is_add_on,
        })),
        features: Object.fromEntries(
          Object.entries(cust.features).map(([key, f]) => [
            key,
            {
              type: f.type,
              balance: f.balance,
              usage: f.usage,
              includedUsage: f.included_usage,
              nextResetAt: ts(f.next_reset_at),
              unlimited: f.unlimited,
            },
          ]),
        ),
        discounts: cust.rewards?.discounts ?? [],
      }

      allCustomers.push(exported)
      console.log(
        `    ${cust.email ?? cust.id} — ${paidProducts.map((p) => `${p.id}:${p.status}`).join(', ')}`,
      )
    }

    offset += page.list.length
    if (page.list.length < PAGE_SIZE) break
  }

  const outPath = new URL('../../existing_customers.json', import.meta.url).pathname
  await Bun.write(outPath, JSON.stringify(allCustomers, null, 2))
  console.log(`\nExported ${allCustomers.length} paid customers to existing_customers.json`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
