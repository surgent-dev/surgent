/**
 * Domain provider abstraction.
 * Simplified: Entri handles purchase + DNS via its own SDK, so only
 * availability checking is done via API.
 */

export interface DomainAvailabilityResult {
  domain: string
  available: boolean
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
  checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]>
}
