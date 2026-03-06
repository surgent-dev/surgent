/**
 * Domain provider factory.
 *
 * Returns the concrete DomainProvider based on the DOMAIN_PROVIDER env var.
 * Falls back to 'entri' when the variable is unset.
 */

import { config } from '../config'
import type { DomainProvider } from './provider'

export type { DomainProvider } from './provider'
export type {
  DomainAvailabilityResult,
  DomainPricing,
  DomainRegistrationResult,
  DomainContact,
  DnsRecord,
} from './provider'
export { expandDomainQuery } from './namecheap'

let cached: DomainProvider | null = null

export async function getDomainProvider(): Promise<DomainProvider> {
  if (cached) return cached

  const provider = config.domainProvider

  switch (provider) {
    case 'namecheap': {
      const { NamecheapProvider } = await import('./namecheap')
      cached = new NamecheapProvider()
      break
    }
    case 'entri':
    default: {
      const { EntriDomainProvider } = await import('./entri-adapter')
      cached = new EntriDomainProvider()
      break
    }
  }

  return cached
}
