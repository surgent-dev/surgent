/**
 * Surpay SDK Type Definitions
 *
 * These types mirror your Rust API's request/response shapes.
 * We use snake_case to match the API directly.
 */

// ============================================================================
// Result Pattern Types
// ============================================================================

export type Success<T> = { data: T; error: null; statusCode: number }
export type Failure<E> = { data: null; error: E; statusCode: number }
export type Result<T, E = unknown> = Success<T> | Failure<E>

// ============================================================================
// Enums (as union types)
// ============================================================================

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'

export type RecurringInterval = 'day' | 'week' | 'month' | 'year'

export type TransactionType = 'payment' | 'processor_fee' | 'refund' | 'dispute' | 'balance' | 'payout'

export type CheckoutStatus = 'open' | 'complete' | 'expired'
export type CheckoutMode = 'payment' | 'subscription' | 'setup'

export type PayoutStatus = 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed'

// ============================================================================
// Project
// ============================================================================

export interface Project {
  id: string
  name: string
  slug?: string
  external_id?: string | null
  organization_id?: string | null
}

// ============================================================================
// Customer
// ============================================================================

export interface Customer {
  id: string
  email: string
  name?: string | null
  processor_customer_id?: string | null
  project_id?: string | null
}

export interface TransactionSummary {
  id: string
  created_at: string
  type: TransactionType
  amount: number
  currency: string
}

export interface SubscriptionSummary {
  id: string
  created_at: string
  current_period_start?: string
  current_period_end?: string
  status: SubscriptionStatus
  processor_subscription_id?: string
}

export interface CustomerWithDetails extends Customer {
  transactions: TransactionSummary[]
  subscriptions: SubscriptionSummary[]
}

// ============================================================================
// Product
// ============================================================================

export interface CreateProductRequest {
  project_id: string
  product_group_id: string
  name: string
  description?: string
  is_default?: boolean
  slug: string
}

export interface CreateProductResponse {
  product_id: string
  product_group_id: string
  version: number
}

export interface UpdateProductRequest {
  name?: string
  description?: string
  slug?: string
  is_default?: boolean
  is_archived?: boolean
}

export interface UpdateProductResponse {
  product_id: string
  product_group_id: string
  version: number
}

export interface Product {
  id: string
  product_group_id: string
  name: string
  slug: string
  description?: string | null
  is_archived?: boolean | null
  is_default?: boolean | null
  processor_product_id?: string | null
  project_id?: string | null
  version?: number | null
}

// ============================================================================
// Price
// ============================================================================

export interface CreatePriceRequest {
  project_id: string
  product_group_id: string
  name?: string
  description?: string
  is_default?: boolean
  price: number
  price_currency: string
  recurring_interval?: RecurringInterval
}

export interface CreatePriceResponse {
  product_price_id: string
}

export interface ProductPrice {
  id: string
  name?: string | null
  description?: string | null
  price_amount?: number | null
  price_currency?: string | null
  is_default?: boolean | null
  recurring_interval?: RecurringInterval | null
}

export interface ProductWithPrices {
  product: Product
  prices: ProductPrice[]
}

// ============================================================================
// Checkout
// ============================================================================

export interface CreateCheckoutRequest {
  product_id: string
  price_id: string
  success_url: string
  cancel_url: string
}

export interface CreateCheckoutResponse {
  checkout_url: string
  session_id: string
}

// ============================================================================
// Transaction
// ============================================================================

export interface Transaction {
  id: string
  created_at: string
  type: TransactionType
  amount: number
  currency: string
  processor: string

  // Optional fields
  account_id?: string | null
  account_amount?: number | null
  account_currency?: string | null
  charge_id?: string | null
  checkout_session_id?: string | null
  customer_id?: string | null
  incurred_by_transaction_id?: string | null
  metadata?: Record<string, unknown>
  payment_transaction_id?: string | null
  payout_id?: string | null
  payout_transaction_id?: string | null
  presentment_amount?: number | null
  presentment_currency?: string | null
  presentment_tax_amount?: number | null
  processor_invoice_id?: string | null
  product_id?: string | null
  product_price_id?: string | null
  project_id?: string | null
  refund_id?: string | null
  refunded_at?: string | null
  subscription_id?: string | null
  succeeded_at?: string | null
  tax_amount?: number | null
  tax_country?: string | null
  tax_filing_amount?: number | null
  tax_filing_currency?: string | null
  tax_state?: string | null
  transfer_id?: string | null
}

// ============================================================================
// Subscription
// ============================================================================

export interface Subscription {
  id: string
  created_at: string
  status: SubscriptionStatus

  canceled_at?: string | null
  current_period_end?: string | null
  current_period_start?: string | null
  customer_id?: string | null
  deleted_at?: string | null
  ended_at?: string | null
  processor_customer_id?: string | null
  processor_subscription_id?: string | null
  product_id?: string | null
  product_price_id?: string | null
  project_id?: string | null
}

// ============================================================================
// Connected Accounts (Stripe Connect)
// ============================================================================

export interface ConnectAccountRequest {
  /** Required for session auth, optional for API key auth */
  project_id?: string
  processor: string
  account_type?: string
  country?: string
  email?: string
  business_type?: string
}

export interface ConnectAccountResponse {
  account_id: string
  oauth_url: string
}

export interface ConnectedAccount {
  id: string
  project_id: string
  processor: string
  status: string
  country: string
  currency: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  business_type?: string | null
  processor_account_id?: string | null
}

// ============================================================================
// SDK Configuration
// ============================================================================

export interface SurpayConfig {
  /** Your Surpay API key (64 alphabetic characters) */
  apiKey?: string
  /** Override the base URL (default: https://api.surpay.io) */
  baseUrl?: string
}
