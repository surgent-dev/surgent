/**
 * Domain provider abstraction.
 *
 * Every concrete provider (Entri, Namecheap, …) must implement this interface
 * so the domain routes can stay provider-agnostic.
 */

export interface DomainAvailabilityResult {
  domain: string
  available: boolean
  /** Optional price in USD (only some providers return this) */
  price?: number
  reason: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSUPPORTED_TLD' | 'ERROR'
  checkedAt: string
}

export interface DomainPricing {
  tld: string
  registerPrice: number
  renewPrice?: number
  currency: string
}

export interface DomainRegistrationResult {
  domain: string
  registered: boolean
  registrar: string
  chargedAmount?: number
  domainId?: string
  orderId?: string
  transactionId?: string
}

export interface DnsRecord {
  type: string
  host: string
  value: string
  ttl: number
}

export interface DomainContact {
  firstName: string
  lastName: string
  address1: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  phone: string
  email: string
}

export interface DomainProvider {
  readonly name: string

  /** Check whether one or more domains are available for registration. */
  checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]>

  /** Get registration pricing for TLDs. */
  getPricing(tlds?: string[]): Promise<DomainPricing[]>

  /** Register a domain. */
  registerDomain(
    domain: string,
    years: number,
    contact: DomainContact,
  ): Promise<DomainRegistrationResult>

  /** Point a domain's DNS at the given records. */
  setDnsRecords(domain: string, records: DnsRecord[]): Promise<void>
}
