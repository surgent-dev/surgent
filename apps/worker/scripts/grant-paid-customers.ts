/// <reference types="bun" />

/**
 * Grant $25 prepaid credits to customers who paid on the old Stripe account.
 *
 * Usage:
 *   DATABASE_URL='...' bun apps/worker/scripts/grant-paid-customers.ts --dry-run
 *   DATABASE_URL='...' bun apps/worker/scripts/grant-paid-customers.ts
 */

import { db } from '../src/lib/db'
import { grantCredits } from '../src/lib/billing'

const DRY_RUN = process.argv.includes('--dry-run')
const GRANT_AMOUNT_USD = 25

// Customers who actually paid on the old Stripe account (sk_live_51SSsZC...)
const PAID_CUSTOMERS: string[] = [
  'savirneni03@gmail.com',
  'teateayuen@gmail.com',
  'vpagbrands@gmail.com',
  'mmaxmudov1997@gmail.com',
  'jbarre1099@gmail.com',
  'kenneththomas1993@gmail.com',
  'gapost.info@gmail.com',
  'pete.vrondas@gmail.com',
  'willpinder1@gmail.com',
  'juanigari71996@gmail.com',
  'lukole777@gmail.com',
  'smmusta.edu@gmail.com',
  'hamza@caeros.co',
  'karelmarkus.truus@gmail.com',
  'magomedov.batal2014@gmail.com',
  'domee.ubah@gmail.com',
  'tylerngo10@gmail.com',
  'reubenolelewe101@gmail.com',
  'aviagola@uw.edu',
  'nel56.m32@gmail.com',
  'aden@chatarv.com',
]

async function run() {
  console.log(
    `${PAID_CUSTOMERS.length} paid customers → $${GRANT_AMOUNT_USD} each.${DRY_RUN ? ' (DRY RUN)\n' : '\n'}`,
  )

  let ok = 0
  let skip = 0

  for (const email of PAID_CUSTOMERS) {
    const user = await db
      .selectFrom('user')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst()

    if (!user) {
      console.log(`  SKIP ${email} — no user in DB`)
      skip++
      continue
    }

    const member = await db
      .selectFrom('member')
      .select('organizationId')
      .where('userId', '=', user.id)
      .executeTakeFirst()

    if (!member) {
      console.log(`  SKIP ${email} — no org`)
      skip++
      continue
    }

    const orgId = member.organizationId
    console.log(`  ${email} → ${orgId} → $${GRANT_AMOUNT_USD} prepaid`)

    if (!DRY_RUN) {
      await grantCredits({
        organizationId: orgId,
        amountUsd: GRANT_AMOUNT_USD,
        reason: 'old_stripe_paid_customer_migration',
        idempotencyKey: `old-stripe-grant:${orgId}`,
        metadata: { email, source: 'old_stripe_account', grantDollars: GRANT_AMOUNT_USD },
      })
    }

    ok++
  }

  console.log(`\nDone: ${ok} granted, ${skip} skipped`)
  console.log(`Total: $${ok * GRANT_AMOUNT_USD}`)
  await db.destroy()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
