/**
 * Surpay Admin Client
 *
 * SDK client for organization-level operations (master key required).
 */

import { SurpayClient } from './client.js'
import type { SurpayAdminConfig, CreateOrganizationRequest, CreateOrganizationResponse } from './types.js'

export class SurpayAdmin extends SurpayClient {
  constructor(options?: SurpayAdminConfig) {
    const envMasterKey = typeof process !== 'undefined' ? process.env.SURPAY_MASTER_KEY : undefined
    const masterKey = options?.masterKey || envMasterKey || ''
    const baseUrl = options?.baseUrl

    if (!masterKey) {
      throw new Error('Surpay master key is required. Pass it via options or set SURPAY_MASTER_KEY env var.')
    }

    if (!masterKey.startsWith('sp_master_')) {
      throw new Error('Invalid master key format. Admin keys must start with sp_master_')
    }

    super({ apiKey: masterKey, baseUrl })
  }

  organization = {
    create: (params: CreateOrganizationRequest) => this.post<CreateOrganizationResponse>('/organization', params),
  }
}
