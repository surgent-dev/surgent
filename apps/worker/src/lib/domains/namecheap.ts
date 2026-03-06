import { config } from '../config'
import { createLogger } from '../logger'
import { parseNamecheapResponse } from './xml'
import type {
  DomainProvider,
  DomainAvailabilityResult,
  DomainPricing,
  DomainRegistrationResult,
  DomainContact,
  DnsRecord,
} from './provider'

const log = createLogger('namecheap')

const DEFAULT_TLDS = ['com', 'dev', 'io', 'app', 'co', 'net', 'org', 'site', 'xyz', 'ai']

/**
 * Expand a bare query (e.g. "coolapp") into a list of FQDNs.
 * If the query already contains a dot it's returned as-is.
 */
export function expandDomainQuery(query: string, tlds: string[] = DEFAULT_TLDS): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  if (q.includes('.')) return [q]
  return tlds.map((tld) => `${q}.${tld}`)
}

/** Split "foo.co.uk" → { sld: "foo", tld: "co.uk" } */
function splitDomain(domain: string): { sld: string; tld: string } {
  const parts = domain.split('.')
  return { sld: parts[0], tld: parts.slice(1).join('.') }
}

/** Chunk an array into batches of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export class NamecheapProvider implements DomainProvider {
  readonly name = 'namecheap'

  private get baseUrl(): string {
    return config.namecheap.sandbox
      ? 'https://api.sandbox.namecheap.com/xml.response'
      : 'https://api.namecheap.com/xml.response'
  }

  private globalParams(): Record<string, string> {
    return {
      ApiUser: config.namecheap.apiUser,
      ApiKey: config.namecheap.apiKey,
      UserName: config.namecheap.userName,
      ClientIp: config.namecheap.clientIp,
    }
  }

  /** Build a URL with global + command-specific query params and fetch XML. */
  private async call(command: string, params: Record<string, string> = {}): Promise<string> {
    const qs = new URLSearchParams({
      ...this.globalParams(),
      Command: command,
      ...params,
    })
    const url = `${this.baseUrl}?${qs.toString()}`
    log.debug({ command, params }, 'namecheap request')

    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      log.error({ status: res.status, command, body: text }, 'namecheap HTTP error')
      throw new Error(`Namecheap HTTP ${res.status}`)
    }
    return res.text()
  }

  // ── checkAvailability ──────────────────────────────────────

  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    if (domains.length === 0) return []

    const batches = chunk(domains, 50)
    const results: DomainAvailabilityResult[] = []

    for (const batch of batches) {
      const xml = await this.call('namecheap.domains.check', {
        DomainList: batch.join(','),
      })

      const cmd = parseNamecheapResponse(xml) as {
        DomainCheckResult: Array<{
          '@_Domain': string
          '@_Available': string
          '@_IsPremiumName'?: string
          '@_PremiumRegistrationPrice'?: string
        }>
      }

      for (const r of cmd.DomainCheckResult) {
        const available = r['@_Available'] === 'true'
        const price =
          r['@_IsPremiumName'] === 'true' && r['@_PremiumRegistrationPrice']
            ? parseFloat(r['@_PremiumRegistrationPrice'])
            : undefined

        results.push({
          domain: r['@_Domain'],
          available,
          price,
          reason: available ? 'AVAILABLE' : 'UNAVAILABLE',
          checkedAt: new Date().toISOString(),
        })
      }
    }

    log.info({ count: results.length }, 'availability check completed')
    return results
  }

  // ── getPricing ─────────────────────────────────────────────

  async getPricing(tlds?: string[]): Promise<DomainPricing[]> {
    const xml = await this.call('namecheap.users.getPricing', {
      ProductType: 'DOMAIN',
      ActionName: 'REGISTER',
    })

    const cmd = parseNamecheapResponse(xml) as {
      UserGetPricingResult: {
        ProductType: {
          ProductCategory: Array<{
            '@_Name': string
            Product: Array<{
              '@_Name': string
              Price: Array<{
                '@_Duration': string
                '@_YourPrice': string
                '@_Currency'?: string
              }>
            }>
          }>
        }
      }
    }

    const categories = cmd.UserGetPricingResult?.ProductType?.ProductCategory ?? []
    const registerCat = categories.find((c) => c['@_Name']?.toLowerCase() === 'register')
    if (!registerCat) return []

    const products = registerCat.Product ?? []
    const targetTlds = tlds ? new Set(tlds.map((t) => t.toLowerCase())) : null

    const results: DomainPricing[] = []

    for (const product of products) {
      const tld = product['@_Name']?.toLowerCase()
      if (!tld) continue
      if (targetTlds && !targetTlds.has(tld)) continue

      // Find the 1-year price
      const prices = product.Price ?? []
      const oneYear = prices.find((p) => p['@_Duration'] === '1')
      if (!oneYear) continue

      results.push({
        tld,
        registerPrice: parseFloat(oneYear['@_YourPrice']),
        currency: oneYear['@_Currency'] || 'USD',
      })
    }

    log.info({ count: results.length }, 'pricing fetched')
    return results
  }

  // ── registerDomain ─────────────────────────────────────────

  async registerDomain(
    domain: string,
    years: number,
    contact: DomainContact,
  ): Promise<DomainRegistrationResult> {
    const contactParams: Record<string, string> = {}
    const prefixes = ['Registrant', 'Tech', 'Admin', 'AuxBilling']
    for (const prefix of prefixes) {
      contactParams[`${prefix}FirstName`] = contact.firstName
      contactParams[`${prefix}LastName`] = contact.lastName
      contactParams[`${prefix}Address1`] = contact.address1
      contactParams[`${prefix}City`] = contact.city
      contactParams[`${prefix}StateProvince`] = contact.stateProvince
      contactParams[`${prefix}PostalCode`] = contact.postalCode
      contactParams[`${prefix}Country`] = contact.country
      contactParams[`${prefix}Phone`] = contact.phone
      contactParams[`${prefix}EmailAddress`] = contact.email
    }

    const xml = await this.call('namecheap.domains.create', {
      DomainName: domain,
      Years: String(years),
      AddFreeWhoisguard: 'yes',
      WGEnabled: 'yes',
      ...contactParams,
    })

    const cmd = parseNamecheapResponse(xml) as {
      DomainCreateResult: {
        '@_Domain': string
        '@_Registered': string
        '@_ChargedAmount'?: string
        '@_DomainID'?: string
        '@_OrderID'?: string
        '@_TransactionID'?: string
      }
    }

    const r = cmd.DomainCreateResult
    const registered = r['@_Registered'] === 'true'

    log.info({ domain, registered }, 'domain registration result')

    return {
      domain: r['@_Domain'],
      registered,
      registrar: 'namecheap',
      chargedAmount: r['@_ChargedAmount'] ? parseFloat(r['@_ChargedAmount']) : undefined,
      domainId: r['@_DomainID'],
      orderId: r['@_OrderID'],
      transactionId: r['@_TransactionID'],
    }
  }

  // ── setDnsRecords ──────────────────────────────────────────

  async setDnsRecords(domain: string, records: DnsRecord[]): Promise<void> {
    const { sld, tld } = splitDomain(domain)

    const params: Record<string, string> = { SLD: sld, TLD: tld }

    records.forEach((rec, i) => {
      const n = i + 1
      params[`HostName${n}`] = rec.host
      params[`RecordType${n}`] = rec.type
      params[`Address${n}`] = rec.value
      params[`TTL${n}`] = String(rec.ttl)
    })

    const xml = await this.call('namecheap.domains.dns.setHosts', params)
    parseNamecheapResponse(xml) // throws on error

    log.info({ domain, recordCount: records.length }, 'DNS records set')
  }
}
