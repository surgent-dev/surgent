/**
 * Domain provider factory.
 * Entri is the sole provider — Namecheap has been removed.
 */

import type { DomainProvider } from './provider'

export type { DomainProvider } from './provider'
export type {
  DomainAvailabilityResult,
  DomainPricing,
  DomainRegistrationResult,
  DomainContact,
  DnsRecord,
} from './provider'

export function expandDomainQuery(query: string): string[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []
  if (/\.[a-z]{2,}$/.test(trimmed)) return [trimmed]
  return ['.com', '.io', '.dev', '.app', '.co', '.net', '.org'].map((tld) => trimmed + tld)
}

let cached: DomainProvider | null = null

export async function getDomainProvider(): Promise<DomainProvider> {
  if (cached) return cached
  const { EntriDomainProvider } = await import('./entri-adapter')
  cached = new EntriDomainProvider()
  return cached
}
