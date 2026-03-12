/// <reference types="bun" />

/**
 * Grant prepaid migration credits to existing customers.
 *
 * Usage:
 *   DATABASE_URL='...' bun apps/worker/scripts/migrate-billing-credits.ts ./migration-grants.json --dry-run
 *   DATABASE_URL='...' bun apps/worker/scripts/migrate-billing-credits.ts ./migration-grants.json
 *
 * JSON format:
 * [
 *   { "organizationId": "org_123", "amountUsd": 25, "reason": "billing_migration" },
 *   { "email": "user@example.com", "amountUsd": 2, "reason": "billing_migration" }
 * ]
 */

import { db } from '../src/lib/db'
import { grantCredits } from '../src/lib/billing'

type Grant = {
  organizationId?: string
  email?: string
  amountUsd: number
  reason?: string
}

const file = process.argv[2]
const DRY_RUN = process.argv.includes('--dry-run')

if (!file) {
  console.error(
    'Usage: bun apps/worker/scripts/migrate-billing-credits.ts ./migration-grants.json [--dry-run]',
  )
  process.exit(1)
}

async function resolveOrganizationId(item: Grant) {
  if (item.organizationId) return item.organizationId

  if (!item.email) {
    throw new Error('Grant entry must include organizationId or email')
  }

  const rows = await db
    .selectFrom('member as m')
    .innerJoin('user as u', 'u.id', 'm.userId')
    .select(['m.organizationId', 'u.email'])
    .where('u.email', '=', item.email)
    .execute()

  if (!rows.length) {
    throw new Error(`No org found for email ${item.email}`)
  }

  if (rows.length > 1) {
    const orgs = rows.map((r) => r.organizationId).join(', ')
    throw new Error(
      `Email ${item.email} belongs to multiple orgs: ${orgs}. Use organizationId instead.`,
    )
  }

  return rows[0].organizationId
}

async function run() {
  const grants = (await Bun.file(file).json()) as Grant[]

  let ok = 0
  let skip = 0

  console.log(`${grants.length} entries${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  for (const item of grants) {
    try {
      const orgId = await resolveOrganizationId(item)
      const reason = item.reason ?? 'billing_migration'
      const amountUsd = item.amountUsd

      console.log(`OK   ${orgId} <- $${amountUsd}${item.email ? ` (${item.email})` : ''}`)

      if (!DRY_RUN) {
        await grantCredits({
          organizationId: orgId,
          amountUsd,
          reason,
          idempotencyKey: `billing-migration:${orgId}:${amountUsd}`,
          metadata: {
            source: 'billing_migration',
            migratedFrom: 'legacy_included_balance',
            email: item.email ?? null,
            amountUsd,
          },
        })
      }

      ok++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`SKIP ${item.email ?? item.organizationId ?? 'unknown'} — ${message}`)
      skip++
    }
  }

  console.log(`\nDone: ${ok} ok, ${skip} skipped`)
  await db.destroy()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
