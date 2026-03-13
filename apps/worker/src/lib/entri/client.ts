import { config } from '../config'
import { HttpError } from '../errors'
import { createLogger } from '../logger'

const log = createLogger('entri')

const ENTRI_BASE = 'https://api.goentri.com'

// Well-known taken domains used by the mock to return "unavailable"
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
  reason: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSUPPORTED_TLD' | 'ERROR'
  checkedAt: string
}

const availabilityCache = new Map<string, { result: DomainAvailabilityResult; expiresAt: number }>()
const CACHE_TTL = 60_000 // 60 seconds

export class EntriClient {
  private headers() {
    if (!config.entri.apiKey) throw new HttpError(503, 'Entri API not configured')
    return {
      Authorization: config.entri.apiKey,
      applicationId: config.entri.applicationId || '',
      'Content-Type': 'application/json',
    }
  }

  async checkAvailability(domain: string): Promise<DomainAvailabilityResult> {
    if (config.entri.devMode) {
      return this.mockCheckAvailability(domain)
    }

    // Check cache first
    const cached = availabilityCache.get(domain)
    if (cached && cached.expiresAt > Date.now()) {
      log.debug({ domain }, 'availability cache hit')
      return cached.result
    }

    log.debug({ domain }, 'checking domain availability')

    const res = await fetch(`${ENTRI_BASE}/checkdomainavailability`, {
      method: 'GET',
      headers: {
        ...this.headers(),
        domain,
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      log.error({ status: res.status, domain, body: text }, 'availability check failed')
      throw new HttpError(res.status, `Domain availability check failed: ${res.status}`)
    }

    const data = (await res.json()) as DomainAvailabilityResult
    log.info({ domain, available: data.available, reason: data.reason }, 'availability result')

    // Cache result
    availabilityCache.set(domain, { result: data, expiresAt: Date.now() + CACHE_TTL })

    return data
  }

  private mockCheckAvailability(domain: string): DomainAvailabilityResult {
    const taken = MOCK_TAKEN.has(domain.toLowerCase())
    log.info({ domain, available: !taken }, '[DEV] mock availability check')
    return {
      domain,
      available: !taken,
      reason: taken ? 'UNAVAILABLE' : 'AVAILABLE',
      checkedAt: new Date().toISOString(),
    }
  }
}

export const entriClient = new EntriClient()
