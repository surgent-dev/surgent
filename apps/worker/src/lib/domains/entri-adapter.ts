/**
 * Thin adapter that wraps the existing EntriClient as a DomainProvider.
 *
 * Entri handles purchase + DNS via its own JS SDK / modal. Only availability
 * checking is done via the API.
 */

import { entriClient } from '../entri/client'
import type { DomainProvider, DomainAvailabilityResult } from './provider'

export class EntriDomainProvider implements DomainProvider {
  readonly name = 'entri'

  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    return Promise.all(domains.map((d) => entriClient.checkAvailability(d)))
  }
}
