import { z } from 'zod'

const REFERRAL_COOKIE_NAME = 'surgent_referral'
const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 90
const uuid = z.string().uuid()

function isUuid(value: string) {
  return uuid.safeParse(value).success
}

function getReferralCookieDomain(hostname: string) {
  if (hostname.endsWith('.surgent.dev') || hostname === 'surgent.dev') return '.surgent.dev'
  return undefined
}

export { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE, getReferralCookieDomain, isUuid }
