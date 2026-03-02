/**
 * Thin adapter that wraps the existing EntriClient as a DomainProvider.
 *
 * Entri handles purchase + DNS via its own JS SDK / modal, so registerDomain
 * and setDnsRecords are no-ops here — the actual flow goes through the
 * init-purchase route and Entri webhooks.
 */

import { entriClient } from '../entri/client'
import type {
  DomainProvider,
  DomainAvailabilityResult,
  DomainPricing,
  DomainRegistrationResult,
  DnsRecord,
} from './provider'

export class EntriDomainProvider implements DomainProvider {
  readonly name = 'entri'

  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    const results: DomainAvailabilityResult[] = []
    for (const domain of domains) {
      const r = await entriClient.checkAvailability(domain)
      results.push(r)
    }
    return results
  }

  async getPricing(): Promise<DomainPricing[]> {
    // Entri handles pricing inside its modal — not available via API
    return []
  }

  async registerDomain(): Promise<DomainRegistrationResult> {
    throw new Error('Entri handles registration via its own modal (init-purchase flow)')
  }

  async setDnsRecords(_domain: string, _records: DnsRecord[]): Promise<void> {
    throw new Error('Entri handles DNS configuration via its own flow')
  }
}
