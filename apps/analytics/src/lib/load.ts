import type { Session, Website } from '@/generated/prisma/client'
import redis from '@/lib/redis'
import { getWebsite, getWebsiteByDomainCandidates } from '@/queries/prisma'
import { getWebsiteSession } from '@/queries/sql'

const HOSTNAME_CACHE_TTL = 300

export async function fetchWebsite(websiteId: string): Promise<Website> {
  let website = null

  if (redis.enabled) {
    website = await redis.client.fetch(`website:${websiteId}`, () => getWebsite(websiteId), 86400)
  } else {
    website = await getWebsite(websiteId)
  }

  if (!website || website.deletedAt) {
    return null
  }

  return website
}

function normalizeHostname(hostname: string) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '')
}

export async function fetchWebsiteByHostname(hostname: string): Promise<Website> {
  const normalized = normalizeHostname(hostname)
  const candidates = [normalized, `https://${normalized}`, `http://${normalized}`]

  let website = null

  if (redis.enabled) {
    website = await redis.client.fetch(
      `website:hostname:${normalized}`,
      () => getWebsiteByDomainCandidates(candidates),
      HOSTNAME_CACHE_TTL,
    )
  } else {
    website = await getWebsiteByDomainCandidates(candidates)
  }

  if (!website || website.deletedAt) {
    return null
  }

  return website
}

export async function fetchSession(websiteId: string, sessionId: string): Promise<Session> {
  let session = null

  if (redis.enabled) {
    session = await redis.client.fetch(
      `session:${sessionId}`,
      () => getWebsiteSession(websiteId, sessionId),
      86400,
    )
  } else {
    session = await getWebsiteSession(websiteId, sessionId)
  }

  if (!session) {
    return null
  }

  return session
}
