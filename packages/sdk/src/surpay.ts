/**
 * Surpay Client
 *
 * Main SDK client for tenant-level operations.
 * Uses grouped method namespaces (Autumn pattern).
 */

import { SurpayClient } from './client.js'
import type {
  SurpayConfig,
  Customer,
  CustomerWithDetails,
  CreateProductRequest,
  CreateProductResponse,
  UpdateProductRequest,
  UpdateProductResponse,
  ProductWithPrices,
  CreatePriceRequest,
  CreatePriceResponse,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  Subscription,
  Transaction,
  Project,
  ConnectAccountRequest,
  ConnectAccountResponse,
  ConnectedAccount,
} from './types.js'

export class Surpay extends SurpayClient {
  constructor(options?: SurpayConfig) {
    const envApiKey = typeof process !== 'undefined' ? process.env.SURPAY_API_KEY : undefined
    const apiKey = options?.apiKey || envApiKey || ''
    const baseUrl = options?.baseUrl

    if (!apiKey) {
      throw new Error('Surpay API key is required. Pass it via options or set SURPAY_API_KEY env var.')
    }

    super({ apiKey, baseUrl })
  }

  customers = {
    list: (projectId: string) => this.get<Customer[]>(`/project/${projectId}/customers`),

    get: (projectId: string, customerId: string) =>
      this.get<CustomerWithDetails>(`/project/${projectId}/customer/${customerId}`),
  }

  products = {
    create: (params: CreateProductRequest) => this.post<CreateProductResponse>('/product', params),

    update: (productId: string, params: UpdateProductRequest) =>
      this.put<UpdateProductResponse>(`/product/${productId}`, params),

    listWithPrices: (projectId: string) => this.get<ProductWithPrices[]>(`/project/${projectId}/product/prices`),
  }

  prices = {
    create: (params: CreatePriceRequest) => this.post<CreatePriceResponse>('/product/price', params),
  }

  checkout = {
    create: (params: CreateCheckoutRequest) => this.post<CreateCheckoutResponse>('/checkout', params),
  }

  subscriptions = {
    list: (projectId: string) => this.get<Subscription[]>(`/project/${projectId}/subscriptions`),
  }

  transactions = {
    list: (projectId: string) => this.get<Transaction[]>(`/project/${projectId}/transactions`),
  }

  projects = {
    list: async () => {
      const result = await this.get<Project[] | { projects: Project[] }>('/projects')
      if (result.error) {
        return result
      }
      // Normalize wrapped response: { projects: [...] } -> [...]
      const data = Array.isArray(result.data) ? result.data : (result.data as { projects: Project[] }).projects || []
      return { data, error: null, statusCode: result.statusCode }
    },
  }

  accounts = {
    connect: (params: ConnectAccountRequest) => this.post<ConnectAccountResponse>('/accounts/connect', params),

    get: (accountId: string) => this.get<ConnectedAccount>(`/accounts/${accountId}`),

    list: () => this.get<ConnectedAccount[]>('/accounts'),
  }
}
