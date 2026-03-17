import { config } from '../config'
import { HttpError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('entri')
const ENTRI_BASE = 'https://api.goentri.com'
const CACHE_TTL = 60_000
const MAX_CACHE_ENTRIES = 500

const MOCK_TAKEN = new Set([
  'google.com',
  'facebook.com',
  'amazon.com',
  'apple.com',
  'microsoft.com',
  'github.com',
  'surgent.dev',
  'example.com',
])

export interface DomainAvailabilityResult {
  domain: string
  available: boolean
  price?: number
  reason: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSUPPORTED_TLD' | 'ERROR'
  checkedAt: string
}

interface CacheEntry {
  result: DomainAvailabilityResult
  expiresAt: number
}

const availabilityCache = new Map<string, CacheEntry>()

function getHeaders() {
  if (!config.entri.apiKey) throw new HttpError(503, 'Entri API not configured')
  return {
    Authorization: config.entri.apiKey,
    applicationId: config.entri.applicationId || '',
    'Content-Type': 'application/json',
  }
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase()
}

function mockCheckAvailability(domain: string): DomainAvailabilityResult {
  const taken = MOCK_TAKEN.has(domain)
  log.info({ domain, available: !taken }, '[DEV] mock availability check')
  return {
    domain,
    available: !taken,
    reason: taken ? 'UNAVAILABLE' : 'AVAILABLE',
    checkedAt: new Date().toISOString(),
  }
}

function pruneAvailabilityCache(now: number) {
  for (const [key, value] of availabilityCache) {
    if (value.expiresAt <= now) {
      availabilityCache.delete(key)
    }
  }

  if (availabilityCache.size <= MAX_CACHE_ENTRIES) return

  const overflow = availabilityCache.size - MAX_CACHE_ENTRIES
  let i = 0
  for (const key of availabilityCache.keys()) {
    if (i >= overflow) return
    availabilityCache.delete(key)
    i++
  }
}

function getCachedAvailability(domain: string, now: number) {
  const cached = availabilityCache.get(domain)
  if (!cached || cached.expiresAt <= now) return null

  availabilityCache.delete(domain)
  availabilityCache.set(domain, cached)
  log.debug({ domain }, 'availability cache hit')
  return cached.result
}

function setCachedAvailability(domain: string, result: DomainAvailabilityResult, now: number) {
  availabilityCache.delete(domain)
  availabilityCache.set(domain, { result, expiresAt: now + CACHE_TTL })
}

async function fetchAvailability(domain: string): Promise<DomainAvailabilityResult> {
  log.debug({ domain }, 'checking domain availability')

  const res = await fetch(`${ENTRI_BASE}/checkdomainavailability`, {
    method: 'GET',
    headers: {
      ...getHeaders(),
      domain,
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    log.error({ status: res.status, domain, body }, 'availability check failed')
    throw new HttpError(res.status, `Domain availability check failed: ${res.status}`)
  }

  const result = (await res.json()) as DomainAvailabilityResult
  log.info({ domain, available: result.available, reason: result.reason }, 'availability result')
  return result
}

export async function checkAvailability(input: string): Promise<DomainAvailabilityResult> {
  const domain = normalizeDomain(input)
  const now = Date.now()
  pruneAvailabilityCache(now)

  if (config.entri.devMode) {
    return mockCheckAvailability(domain)
  }

  const cached = getCachedAvailability(domain, now)
  if (cached) return cached

  const result = await fetchAvailability(domain)
  setCachedAvailability(domain, result, now)
  return result
}
