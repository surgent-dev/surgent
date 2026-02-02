'use client'

import { useMemo } from 'react'
import { format, subDays, isAfter } from 'date-fns'
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  ChevronRight,
  Package,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatPrice, formatCompactPrice, formatTransactionType } from './utils'
import type { ProductWithPrices } from '@/queries/products'
import type { Transaction, TransactionType } from '@/queries/transactions'

const getTransactionIcon = (type: TransactionType) => {
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

const getTransactionColor = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return 'text-emerald-500'
    case 'refund':
    case 'dispute':
      return 'text-red-500'
    case 'payout':
      return 'text-blue-500'
    default:
      return 'text-muted-foreground'
  }
}

const getTransactionBg = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return 'bg-emerald-500/10'
    case 'refund':
    case 'dispute':
      return 'bg-red-500/10'
    case 'payout':
      return 'bg-blue-500/10'
    default:
      return 'bg-muted'
  }
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="rounded-lg bg-muted/50 p-2 w-fit">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
      </div>
    </div>
  )
}

function RecentActivityItem({ transaction }: { transaction: Transaction }) {
  const Icon = getTransactionIcon(transaction.type)
  const colorClass = getTransactionColor(transaction.type)
  const bgClass = getTransactionBg(transaction.type)
  const isPositive = transaction.type === 'payment'

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={cn('rounded-lg p-2', bgClass)}>
        <Icon className={cn('size-3.5', colorClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{formatTransactionType(transaction.type)}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(transaction.createdAt), 'MMM d, h:mm a')}
        </p>
      </div>
      <p className={cn('text-sm font-semibold tabular-nums', colorClass)}>
        {isPositive ? '+' : '-'}
        {formatPrice(Math.abs(transaction.amount), transaction.currency)}
      </p>
    </div>
  )
}

interface DashboardViewProps {
  products: ProductWithPrices[]
  transactions: Transaction[]
  onCreateProduct: () => void
}

export function DashboardView({ products, transactions, onCreateProduct }: DashboardViewProps) {
  const stats = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const recent = transactions.filter((t) => isAfter(new Date(t.createdAt), thirtyDaysAgo))
    const totalRevenue = recent
      .filter((t) => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0)
    const totalRefunds = recent
      .filter((t) => t.type === 'refund')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    return {
      netRevenue: totalRevenue - totalRefunds,
      totalRevenue,
      totalRefunds,
      paymentCount: recent.filter((t) => t.type === 'payment').length,
      uniqueCustomers: new Set(recent.filter((t) => t.customerId).map((t) => t.customerId)).size,
      activeProducts: products.filter((p) => !p.product.isArchived && p.prices.length > 0).length,
    }
  }, [products, transactions])

  if (products.length === 0 && transactions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-brand/20 via-brand/10 to-transparent p-6">
              <BadgeDollarSign className="size-12 text-brand" strokeWidth={1.5} />
            </div>
            <div className="absolute -bottom-1 -right-1 rounded-full bg-brand p-2 shadow-lg">
              <Sparkles className="size-4 text-brand-foreground" />
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Welcome to Payments</h2>
          <p className="text-muted-foreground mb-6">
            Create your first product to start accepting payments.
          </p>
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-brand-foreground font-medium hover:bg-brand/90 transition-colors"
          >
            <Plus className="size-4" />
            Create Your First Product
          </button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Net Revenue"
            value={formatCompactPrice(stats.netRevenue, 'usd')}
            subtitle="Last 30 days"
            icon={BadgeDollarSign}
          />
          <StatCard
            title="Transactions"
            value={stats.paymentCount}
            subtitle="Successful payments"
            icon={Receipt}
          />
          <StatCard
            title="Customers"
            value={stats.uniqueCustomers}
            subtitle="Unique buyers"
            icon={Users}
          />
          <StatCard
            title="Active Products"
            value={stats.activeProducts}
            subtitle="With pricing"
            icon={Package}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Recent Activity</h3>
              {transactions.length > 5 && (
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  View all <ChevronRight className="size-3" />
                </button>
              )}
            </div>
            {transactions.length > 0 ? (
              <div className="px-4 divide-y">
                {transactions.slice(0, 5).map((t) => (
                  <RecentActivityItem key={t.id} transaction={t} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Receipt
                  className="size-8 text-muted-foreground/50 mx-auto mb-2"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-3">Revenue Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-muted-foreground">Gross Revenue</span>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatPrice(stats.totalRevenue, 'usd')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">Refunds</span>
                </div>
                <span className="text-sm font-medium tabular-nums text-red-500">
                  -{formatPrice(stats.totalRefunds, 'usd')}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Net Revenue</span>
                <span className="text-sm font-bold tabular-nums">
                  {formatPrice(stats.netRevenue, 'usd')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
