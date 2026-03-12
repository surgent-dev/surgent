/// <reference types="bun" />

/**
 * Grant Autumn customers prepaid credits in the new billing system.
 *
 * - Maps remaining Autumn ai_credits to prepaid balance
 * - Keeps users on their current Surgent plan
 * - Uses the shared billing grant path and a stable idempotency key
 *
 * Usage:
 *   DATABASE_URL='...' bun apps/worker/scripts/backfill-autumn-customers.ts --dry-run
 *   DATABASE_URL='...' bun apps/worker/scripts/backfill-autumn-customers.ts
 */

import { db } from '../src/lib/db'
import { config } from '../src/lib/config'
import { grantCredits } from '../src/lib/billing'

const DRY_RUN = process.argv.includes('--dry-run')

type AutumnCustomer = {
  autumnId: string | null
  email: string | null
  products: Array<{ id: string; name: string | null }>
  features: Record<
    string,
    {
      balance: number | null
      usage: number | null
      includedUsage: number | null
    }
  >
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100
}

async function run() {
  const path = new URL('../../existing_customers.json', import.meta.url).pathname
  const customers: AutumnCustomer[] = JSON.parse(await Bun.file(path).text())

  console.log(`${customers.length} Autumn customers.${DRY_RUN ? ' (DRY RUN)\n' : '\n'}`)

  let ok = 0
  let skip = 0
  let total = 0

  for (const cust of customers) {
    if (!cust.email) {
      skip++
      continue
    }

    const credits = cust.features?.ai_credits
    const balance = credits?.balance ?? 0
    const included = credits?.includedUsage ?? 0
    if (balance <= 0) {
      console.log(`  SKIP ${cust.email} — 0 credits remaining`)
      skip++
      continue
    }
    if (included <= 0) {
      console.log(`  SKIP ${cust.email} — missing includedUsage`)
      skip++
      continue
    }

    const amountUsd = roundUsd((balance / included) * config.stripe.pro.month.allowanceUsd)
    if (amountUsd <= 0) {
      console.log(`  SKIP ${cust.email} — rounded grant is $0.00`)
      skip++
      continue
    }

    const user = await db
      .selectFrom('user')
      .select('id')
      .where('email', '=', cust.email)
      .executeTakeFirst()

    if (!user) {
      console.log(`  SKIP ${cust.email} — no user`)
      skip++
      continue
    }

    const member = await db
      .selectFrom('member')
      .select('organizationId')
      .where('userId', '=', user.id)
      .executeTakeFirst()

    if (!member) {
      console.log(`  SKIP ${cust.email} — no org`)
      skip++
      continue
    }

    const orgId = member.organizationId
    const product = cust.products[0]

    console.log(
      `  ${cust.email} → ${orgId}` +
        ` | ${product?.id ?? '?'}(${product?.name ?? '?'})` +
        ` | ${balance}/${included} credits → $${amountUsd.toFixed(2)} prepaid`,
    )

    if (DRY_RUN) {
      ok++
      total += amountUsd
      continue
    }

    await grantCredits({
      organizationId: orgId,
      amountUsd,
      reason: 'autumn_migration_grant',
      idempotencyKey: `autumn-grant:${orgId}`,
      metadata: {
        autumnId: cust.autumnId,
        email: cust.email,
        product: product?.id ?? null,
        productName: product?.name ?? null,
        autumnCreditsBalance: balance,
        autumnCreditsIncluded: included,
        grantDollars: amountUsd.toFixed(2),
      },
    })

    ok++
    total += amountUsd
  }

  console.log(`\nDone: ${ok} granted, ${skip} skipped`)
  console.log(`Total granted: $${total.toFixed(2)}`)
  await db.destroy()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
