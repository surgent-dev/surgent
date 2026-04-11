import type { GenericEndpointContext } from 'better-auth'
import { sql } from 'kysely'
import { z } from 'zod'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { grantCredits } from '@/lib/billing'
import { ensureActiveOrganization } from '@/lib/organizations'
import { createLogger } from '@/lib/logger'

const REFERRAL_COOKIE_NAME = 'surgent_referral'
const REFERRAL_SIGNUP_REWARD_USD = 1
const REFERRAL_CONVERSION_REWARD_USD = 2
const REFERRAL_HARD_LIMIT = 10
const REFERRAL_CONVERSION_GATE_THRESHOLD = 3
const uuid = z.string().uuid()
const log = createLogger('referrals')

function isUuid(value: string) {
  return uuid.safeParse(value).success
}

function getReferralCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.env.NODE_ENV === 'production',
    ...(config.env.NODE_ENV === 'production' ? { domain: '.surgent.dev' } : {}),
  }
}

function clearReferralCookie(context: GenericEndpointContext | null) {
  if (!context) return
  context.setCookie(REFERRAL_COOKIE_NAME, '', {
    ...getReferralCookieOptions(),
    maxAge: 0,
  })
}

export async function consumeReferralAttribution(
  referredUserId: string,
  context: GenericEndpointContext | null,
) {
  const referrerUserId = context?.getCookie(REFERRAL_COOKIE_NAME)?.trim()
  if (!referrerUserId || !isUuid(referrerUserId)) return

  if (referrerUserId === referredUserId) {
    clearReferralCookie(context)
    return
  }

  try {
    const inserted = await db.transaction().execute(async (tx) => {
      const referrer = await tx
        .selectFrom('user')
        .select('id')
        .where('id', '=', referrerUserId)
        .executeTakeFirst()

      if (!referrer) return null

      // Count existing referrals and conversions for this referrer
      const [countRow, convertedRow] = await Promise.all([
        tx
          .selectFrom('referral')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('referrerUserId', '=', referrerUserId)
          .executeTakeFirst(),
        tx
          .selectFrom('referral')
          .innerJoin('billing_payment', 'billing_payment.organizationId', 'referral.referredUserId')
          .select(sql<number>`count(distinct referral."referredUserId")::int`.as('count'))
          .where('referral.referrerUserId', '=', referrerUserId)
          .where('billing_payment.status', '=', 'paid')
          .where((eb) =>
            eb.or([
              eb('billing_payment.kind', '=', 'topup'),
              eb('billing_payment.kind', '=', 'subscription'),
            ]),
          )
          .executeTakeFirst(),
      ])

      const totalReferrals = Number(countRow?.count ?? 0)
      const conversions = Number(convertedRow?.count ?? 0)

      // Hard limit: 10 referrals max
      if (totalReferrals >= REFERRAL_HARD_LIMIT) {
        log.warn(
          { referrerUserId, totalReferrals },
          '[REFERRAL] blocked — hard limit of %d reached',
          REFERRAL_HARD_LIMIT,
        )
        return null
      }

      // Conversion gate: after 3 referrals, need at least 1 conversion
      if (totalReferrals >= REFERRAL_CONVERSION_GATE_THRESHOLD && conversions < 1) {
        log.warn(
          { referrerUserId, totalReferrals, conversions },
          '[REFERRAL] blocked — %d referrals but no conversions yet',
          totalReferrals,
        )
        return null
      }

      return tx
        .insertInto('referral')
        .values({ referrerUserId, referredUserId })
        .onConflict((oc) => oc.column('referredUserId').doNothing())
        .returning('id')
        .executeTakeFirst()
    })

    clearReferralCookie(context)

    if (!inserted) return

    await grantReferralCredits({
      referrerUserId,
      referredUserId,
      amountUsd: REFERRAL_SIGNUP_REWARD_USD,
      reason: 'Referral signup reward',
      idempotencyKey: `referral:signup:${referrerUserId}:referred:${referredUserId}`,
    })
  } catch (err) {
    log.error({ err, referredUserId, referrerUserId }, '[REFERRAL] attribution failed')
  }
}

async function grantReferralCredits(args: {
  referrerUserId: string
  referredUserId: string
  amountUsd: number
  reason: string
  idempotencyKey: string
}) {
  const organizationId = await ensureActiveOrganization(args.referrerUserId)
  await grantCredits({
    organizationId,
    amountUsd: args.amountUsd,
    reason: args.reason,
    idempotencyKey: args.idempotencyKey,
    metadata: {
      referrerUserId: args.referrerUserId,
      referredUserId: args.referredUserId,
    },
  })
}

export async function grantReferralConversionReward(referredOrganizationId: string) {
  try {
    const referral = await db
      .selectFrom('referral')
      .select(['referrerUserId', 'referredUserId'])
      .where('referredUserId', '=', referredOrganizationId)
      .executeTakeFirst()

    if (!referral) return

    await grantReferralCredits({
      referrerUserId: referral.referrerUserId,
      referredUserId: referral.referredUserId,
      amountUsd: REFERRAL_CONVERSION_REWARD_USD,
      reason: 'Referral conversion reward',
      idempotencyKey: `referral:payment:${referral.referrerUserId}:referred:${referral.referredUserId}`,
    })
  } catch (err) {
    log.error({ err, referredOrganizationId }, '[REFERRAL] conversion reward failed')
  }
}

export async function getReferralStats(userId: string) {
  const [referralRow, convertedRow, rewardRow] = await Promise.all([
    db
      .selectFrom('referral')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('referrerUserId', '=', userId)
      .executeTakeFirst(),
    db
      .selectFrom('referral as referral')
      .innerJoin('billing_payment as payment', 'payment.organizationId', 'referral.referredUserId')
      .select(sql<number>`count(distinct referral."referredUserId")::int`.as('count'))
      .where('referral.referrerUserId', '=', userId)
      .where('payment.status', '=', 'paid')
      .where((eb) =>
        eb.or([eb('payment.kind', '=', 'topup'), eb('payment.kind', '=', 'subscription')]),
      )
      .executeTakeFirst(),
    db
      .selectFrom('billing_payment')
      .select(sql<number>`coalesce(sum(("amountMicros")::bigint), 0)::bigint`.as('amountMicros'))
      .where('kind', '=', 'reward')
      .where('status', '=', 'paid')
      .where((eb) =>
        eb.or([
          eb('idempotencyKey', 'like', `referral:signup:${userId}:referred:%`),
          eb('idempotencyKey', 'like', `referral:payment:${userId}:referred:%`),
        ]),
      )
      .executeTakeFirst(),
  ])

  const signups = Number(referralRow?.count ?? 0)
  const converted = Number(convertedRow?.count ?? 0)
  const earnedUsd = Number(rewardRow?.amountMicros ?? 0) / 100_000_000

  const reachedHardLimit = signups >= REFERRAL_HARD_LIMIT
  const needsConversion = signups >= REFERRAL_CONVERSION_GATE_THRESHOLD && converted < 1
  const canRefer = !reachedHardLimit && !needsConversion

  let message: string | null = null
  if (reachedHardLimit) {
    message = `You've reached the maximum of ${REFERRAL_HARD_LIMIT} referrals.`
  } else if (needsConversion) {
    message = `At least 1 of your ${signups} referred users needs to make a purchase before you can invite more.`
  }

  return {
    link: `${config.server.clientOrigin}?ref=${userId}`,
    signups,
    converted,
    earnedUsd,
    signupRewardUsd: REFERRAL_SIGNUP_REWARD_USD,
    conversionRewardUsd: REFERRAL_CONVERSION_REWARD_USD,
    maxReferrals: REFERRAL_HARD_LIMIT,
    canRefer,
    reachedHardLimit,
    needsConversion,
    message,
  }
}

export {
  REFERRAL_COOKIE_NAME,
  REFERRAL_SIGNUP_REWARD_USD,
  REFERRAL_CONVERSION_REWARD_USD,
  REFERRAL_HARD_LIMIT,
  REFERRAL_CONVERSION_GATE_THRESHOLD,
}
