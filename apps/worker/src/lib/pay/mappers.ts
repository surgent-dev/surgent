import {
  requiredId,
  metadataText,
  toMinorAmount,
  normalizeAccountStatus,
  currencyFromCountry,
} from './utils'

type AccountRow = {
  id: string | null
  projectId: string | null
  whopCompanyId: string
  title: string
  status: string
  metadata: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

type LegacyTransactionType =
  | 'payment'
  | 'processor_fee'
  | 'refund'
  | 'dispute'
  | 'balance'
  | 'payout'

export function toLegacyTransactionType(kind: string): LegacyTransactionType {
  const valid: Record<string, LegacyTransactionType> = {
    payment: 'payment',
    processor_fee: 'processor_fee',
    refund: 'refund',
    dispute: 'dispute',
    balance: 'balance',
    payout: 'payout',
  }
  return valid[kind] || 'payment'
}

export function mapLegacyAccount(row: AccountRow) {
  const country = (metadataText(row.metadata, 'country') || 'us').toLowerCase()
  const currency = (
    metadataText(row.metadata, 'currency') || currencyFromCountry(country)
  ).toLowerCase()
  const status = normalizeAccountStatus(row.status)

  return {
    id: requiredId(row.id, 'account'),
    processor: 'whop',
    status,
    country,
    currency,
    detailsSubmitted: status === 'connected' || status === 'restricted',
    chargesEnabled: status === 'connected',
    payoutsEnabled: status === 'connected',
    businessType: metadataText(row.metadata, 'businessType'),
    processorAccountId: row.whopCompanyId,
    data: {
      ...row.metadata,
      email: metadataText(row.metadata, 'email'),
      title: row.title,
      country,
    },
  }
}

export function mapLegacySubscription(row: {
  id: string | null
  projectId: string | null
  whopMembershipId: string
  whopPlanId: string | null
  whopProductId: string | null
  whopUserId: string | null
  status: string
  createdAt?: Date
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  canceledAt: Date | null
}) {
  return {
    id: requiredId(row.id, 'subscription'),
    projectId: row.projectId,
    productId: row.whopProductId,
    productPriceId: row.whopPlanId,
    customerId: row.whopUserId,
    processorSubscriptionId: row.whopMembershipId,
    processorCustomerId: row.whopUserId,
    createdAt: row.createdAt,
    deletedAt: null,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    canceledAt: row.canceledAt,
    endedAt: row.canceledAt,
    status: row.status,
  }
}

export function mapLegacyTransaction(row: {
  id: string | null
  kind: string
  amount: string | number
  currency: string
  createdAt?: Date
  happenedAt: Date | null
  status: string | null
  processor: string
  metadata: Record<string, unknown>
}) {
  const type = toLegacyTransactionType(row.kind)
  const customerId =
    metadataText(row.metadata, 'customer_id') ||
    metadataText(row.metadata, 'customerId') ||
    metadataText(row.metadata, 'user_id')
  const productId =
    metadataText(row.metadata, 'product_id') || metadataText(row.metadata, 'productId')

  return {
    id: requiredId(row.id, 'transaction'),
    type,
    amount: toMinorAmount(row.amount),
    currency: row.currency,
    createdAt: row.createdAt || row.happenedAt || new Date(),
    succeededAt: row.status === 'succeeded' ? row.happenedAt || row.createdAt || null : null,
    refundedAt: type === 'refund' ? row.happenedAt || row.createdAt || null : null,
    customerId,
    productId,
    processor: row.processor || 'whop',
  }
}
