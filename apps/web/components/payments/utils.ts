import { ArrowDownRight, ArrowUpRight, Receipt } from 'lucide-react'
import type { ProductPrice } from '@/queries/products'
import type { TransactionType } from '@/queries/transactions'

export const formatPrice = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

export const formatInterval = (interval: ProductPrice['recurringInterval']) => {
  switch (interval) {
    case 'month':
      return '/mo'
    case 'year':
      return '/yr'
    case 'week':
      return '/wk'
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

export const getTransactionIcon = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return ArrowDownRight
    case 'refund':
    case 'payout':
      return ArrowUpRight
    default:
      return Receipt
  }
}

export const getTransactionColor = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return 'text-emerald-600'
    case 'refund':
    case 'dispute':
      return 'text-red-500'
    case 'payout':
      return 'text-blue-500'
    default:
      return 'text-muted-foreground'
  }
}

export const parseConnectError = (err: any, fallback: string): string => {
  const msg = err?.message || ''
  const match = msg.match(/PROCESSOR_ALREADY_CONNECTED:(\w+)/)
  if (match) return `Already connected to ${match[1]}. Disconnect it first.`
  return msg || fallback
}
