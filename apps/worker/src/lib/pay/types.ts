export type PayEnv = 'test' | 'live'

export interface PayClientConfig {
  apiKey: string
  platformCompanyId: string
  baseUrl: string
}

export interface CreateCompanyInput {
  title: string
  email?: string
  metadata?: Record<string, unknown>
}

export interface WhopCompany {
  id: string
  title: string
}

export interface CreateAccountLinkInput {
  company_id: string
  use_case: string
  return_url: string
  refresh_url: string
}

export interface CheckoutInlineProduct {
  title: string
  external_identifier: string
}

export interface CheckoutPlanInput {
  company_id: string
  currency: string
  plan_type: 'one_time' | 'renewal'
  initial_price?: number
  renewal_price?: number
  billing_period?: number
  application_fee_amount?: number
  product?: CheckoutInlineProduct
  title?: string
}

export interface CreateCheckoutConfigurationInput {
  mode?: 'payment' | 'setup'
  plan: CheckoutPlanInput
  redirect_url?: string
  metadata?: Record<string, unknown>
}

export interface CheckoutConfiguration {
  id: string
  purchase_url: string
  status?: string
  [key: string]: unknown
}

export interface ParsedWhopWebhookEvent {
  eventId?: string
  eventType: string
  occurredAt?: string
  sessionId?: string
  companyId?: string
  amount?: number
  amountAfterFees?: number
  feeAmount?: number
  feeType?: string
  currency?: string
  paymentId?: string
  refundId?: string
  disputeId?: string
  invoiceId?: string
  membershipId?: string
  withdrawalId?: string
  status?: string
  reason?: string
  userId?: string
  userEmail?: string
  userName?: string
  planId?: string
  productId?: string
  cancelAtPeriodEnd?: boolean
  renewalPeriodStart?: string
  renewalPeriodEnd?: string
  canceledAt?: string
  dueAt?: string
  paidAt?: string
  voidedAt?: string
  billingReason?: string
  paymentMethodType?: string
  cardBrand?: string
  cardLast4?: string
  failureMessage?: string
  metadata: Record<string, unknown>
  data: Record<string, unknown>
}

export interface VerifiedWebhookSignature {
  eventId: string
  timestamp: number
}

export interface WhopWebhookHeadersInput {
  webhookId?: string | null
  webhookTimestamp?: string | null
  webhookSignature?: string | null
}
