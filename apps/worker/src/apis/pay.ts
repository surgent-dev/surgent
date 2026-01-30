import { config } from '@/lib/config'

// Types

export interface Price {
  id: string
  productId: string
  amount: number
  currency: string
  recurringInterval: 'monthly' | 'yearly' | null
  active: boolean
}

export interface Product {
  id: string
  name: string
  description: string | null
  metadata: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

export interface ProductWithPrices extends Product {
  prices: Price[]
}

export interface Subscription {
  id: string
  customerId: string
  productId: string
  priceId: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused'
  currentPeriodStart: string
  currentPeriodEnd: string
}

export interface TransactionSummary {
  totalSpent: number
  transactionCount: number
}

export interface SubscriptionSummary {
  activeCount: number
  totalCount: number
}

export interface Customer {
  id: string
  externalId: string | null
  name: string | null
  email: string | null
  metadata: Record<string, string> | null
}

export interface CustomerWithDetails extends Customer {
  transactionSummary: TransactionSummary
  subscriptionSummary: SubscriptionSummary
}

export interface Transaction {
  id: string
  customerId: string
  productId: string
  priceId: string
  amount: number
  currency: string
  type: 'payment' | 'refund'
  createdAt: string
}

// Helpers

async function safeJsonParse<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text || 'Invalid JSON response')
  }
}

async function payApi<T>(apiKey: string, path: string): Promise<T> {
  if (!config.surpay.baseUrl) {
    throw new Error('Missing SURPAY_BASE_URL')
  }

  const res = await fetch(`${config.surpay.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Surpay API ${res.status}`)
  }

  return safeJsonParse<T>(res)
}

// API Functions

export async function listProducts(apiKey: string): Promise<ProductWithPrices[]> {
  return payApi<ProductWithPrices[]>(apiKey, '/products')
}

export async function listSubscriptions(apiKey: string): Promise<Subscription[]> {
  return payApi<Subscription[]>(apiKey, '/subscriptions')
}

export async function listCustomers(apiKey: string): Promise<CustomerWithDetails[]> {
  return payApi<CustomerWithDetails[]>(apiKey, '/customers')
}

export async function getCustomer(
  apiKey: string,
  customerId: string,
): Promise<CustomerWithDetails> {
  return payApi<CustomerWithDetails>(apiKey, `/customers/${encodeURIComponent(customerId)}`)
}

export async function listTransactions(apiKey: string, projectId: string): Promise<Transaction[]> {
  return payApi<Transaction[]>(apiKey, `/project/${encodeURIComponent(projectId)}/transactions`)
}
