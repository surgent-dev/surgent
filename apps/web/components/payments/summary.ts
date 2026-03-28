import { isAfter, subDays } from 'date-fns'
import type { Subscription } from '@/queries/subscriptions'
import type { Transaction } from '@/queries/transactions'

export function getPaymentSummary(transactions: Transaction[], subscriptions: Subscription[]) {
  const thirtyDaysAgo = subDays(new Date(), 30)
  const recentTransactions = transactions.filter((t) =>
    isAfter(new Date(t.createdAt), thirtyDaysAgo),
  )
  const currency =
    recentTransactions.find((t) => t.currency)?.currency ||
    transactions.find((t) => t.currency)?.currency ||
    'usd'
  const grossRevenue = recentTransactions
    .filter((t) => t.type === 'payment')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalRefunds = recentTransactions
    .filter((t) => t.type === 'refund')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const totalDisputes = recentTransactions
    .filter((t) => t.type === 'dispute')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const totalFees = recentTransactions
    .filter((t) => t.type === 'processor_fee')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return {
    currency,
    grossRevenue,
    netRevenue: grossRevenue - totalRefunds - totalDisputes - totalFees,
    totalRefunds,
    totalDisputes,
    totalFees,
    paymentCount: recentTransactions.filter((t) => t.type === 'payment').length,
    uniqueCustomers: new Set(
      recentTransactions.filter((t) => t.customerId).map((t) => t.customerId),
    ).size,
    activeSubscriptions: subscriptions.filter(
      (s) => s.status === 'active' || s.status === 'trialing',
    ).length,
  }
}
