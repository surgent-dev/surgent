import type {
  CheckoutConfiguration,
  CreateAccountLinkInput,
  CreateCheckoutConfigurationInput,
  CreateCompanyInput,
  PayClientConfig,
  WhopCompany,
} from './types'
import { createLogger } from '@/lib/logger'
import { HttpError } from '@/lib/errors'

const log = createLogger('whop')

function parseWhopError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const message = (body as { error?: { message?: string } }).error?.message
  return typeof message === 'string' && message.length > 0 ? message : fallback
}

function toJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export interface WhopFee {
  name: string
  amount: number
  currency: string
  type: string
}

export class PayClient {
  private readonly apiKey: string
  private readonly platformCompanyId: string
  private readonly baseUrl: string

  constructor(config: PayClientConfig) {
    this.apiKey = config.apiKey
    this.platformCompanyId = config.platformCompanyId
    this.baseUrl = config.baseUrl
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const keyHint = this.apiKey
      ? `${this.apiKey.slice(0, 8)}...${this.apiKey.slice(-4)}`
      : '(empty)'

    log.debug({ method, url, keyHint, company: this.platformCompanyId }, 'request')

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })

    const text = await response.text()
    const data = toJson(text)

    if (!response.ok) {
      log.error({ status: response.status, method, path, body: text }, 'request failed')
      throw new HttpError(
        response.status,
        parseWhopError(data, text || `Whop API ${response.status}`),
      )
    }

    return data as T
  }

  async createCompany(input: CreateCompanyInput): Promise<WhopCompany> {
    return this.request<WhopCompany>('POST', '/companies', {
      title: input.title,
      email: input.email,
      parent_company_id: this.platformCompanyId,
      metadata: input.metadata,
    })
  }

  async createAccessToken(companyId: string): Promise<string> {
    const response = await this.request<{ token?: string; access_token?: string }>(
      'POST',
      '/access_tokens',
      { company_id: companyId },
    )
    const token = response.token || response.access_token
    if (!token) throw new Error('Whop access token response missing token')
    return token
  }

  async createAccountLink(input: CreateAccountLinkInput): Promise<string> {
    const response = await this.request<{ url?: string }>('POST', '/account_links', input)
    if (!response.url) throw new Error('Whop account link response missing url')
    return response.url
  }

  async createCheckoutConfiguration(
    input: CreateCheckoutConfigurationInput,
  ): Promise<CheckoutConfiguration> {
    return this.request<CheckoutConfiguration>('POST', '/checkout_configurations', {
      mode: input.mode || 'payment',
      plan: input.plan,
      redirect_url: input.redirect_url,
      metadata: input.metadata,
    })
  }

  async retrieveCheckoutConfiguration(id: string): Promise<CheckoutConfiguration> {
    return this.request<CheckoutConfiguration>('GET', `/checkout_configurations/${id}`)
  }

  async listPaymentFees(paymentId: string): Promise<WhopFee[]> {
    const response = await this.request<{ data?: WhopFee[] }>('GET', `/payments/${paymentId}/fees`)
    return response.data ?? []
  }

  async cancelMembership(membershipId: string): Promise<{
    id?: string
    status?: string
    canceled_at?: string
    cancel_at_period_end?: boolean
  }> {
    const response = await this.request<{
      id?: string
      status?: string
      canceled_at?: string
      cancel_at_period_end?: boolean
    } | null>('POST', `/memberships/${membershipId}/cancel`, {})
    return response || {}
  }
}
