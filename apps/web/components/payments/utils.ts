import type { ProductPrice } from '@/queries/products'
import type { TransactionType } from '@/queries/transactions'

export const formatPrice = (cents: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export const formatCompactPrice = (cents: number, currency: string) => {
  const value = cents / 100
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return formatPrice(cents, currency)
}

export const formatInterval = (interval: ProductPrice['recurringInterval']) => {
  switch (interval) {
    case 'month':
      return '/mo'
    case 'year':
      return '/yr'
    case 'week':
      return '/wk'
    case 'day':
      return '/day'
    default:
      return ''
  }
}

export const formatTransactionType = (type: TransactionType) => {
  const labels: Record<TransactionType, string> = {
    payment: 'Payment',
    processor_fee: 'Fee',
    refund: 'Refund',
    dispute: 'Dispute',
    balance: 'Balance',
    payout: 'Payout',
  }
  return labels[type] || type
}
