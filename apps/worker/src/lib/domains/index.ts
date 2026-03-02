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

export function getDomainProvider(): DomainProvider {
  if (cached) return cached

  const provider = config.domainProvider

  switch (provider) {
    case 'namecheap': {
      const { NamecheapProvider } = require('./namecheap') as typeof import('./namecheap')
      cached = new NamecheapProvider()
      break
    }
    case 'entri':
    default: {
      // Wrap the existing EntriClient in a DomainProvider-compatible adapter
      const { EntriDomainProvider } = require('./entri-adapter') as typeof import('./entri-adapter')
      cached = new EntriDomainProvider()
      break
    }
  }

  return cached
}
