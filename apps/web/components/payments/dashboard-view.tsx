'use client'

import { useMemo } from 'react'
import { format, subDays, isAfter } from 'date-fns'
import { BadgeDollarSign, ChevronRight, Plus, Receipt, Repeat, Users } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  formatPrice,
  formatTransactionType,
  getTransactionIcon,
  getTransactionColor,
} from './utils'
import type { ProductWithPrices } from '@/queries/products'
import type { Transaction } from '@/queries/transactions'
import type { Subscription } from '@/queries/subscriptions'

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
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground font-medium">{title}</p>
        <Icon className="size-3.5 text-muted-foreground/60" strokeWidth={1.5} />
      </div>
      <p className="text-[22px] font-semibold tabular-nums tracking-tight mt-2">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  )
}

function RecentActivityItem({ transaction }: { transaction: Transaction }) {
  const Icon = getTransactionIcon(transaction.type)
  const colorClass = getTransactionColor(transaction.type)
  const isPositive = transaction.type === 'payment'

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="size-8 rounded-lg bg-muted/50 grid place-items-center">
        <Icon className={cn('size-3.5', colorClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">
          {formatTransactionType(transaction.type)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {format(new Date(transaction.createdAt), 'MMM d, h:mm a')}
        </p>
      </div>
      <p className={cn('text-[13px] font-semibold tabular-nums', colorClass)}>
        {isPositive ? '+' : '-'}
        {formatPrice(Math.abs(transaction.amount), transaction.currency)}
      </p>
    </div>
  )
}

interface DashboardViewProps {
  products: ProductWithPrices[]
  transactions: Transaction[]
  subscriptions: Subscription[]
  onCreateProduct: () => void
}

export function DashboardView({
  products,
  transactions,
  subscriptions,
  onCreateProduct,
}: DashboardViewProps) {
  const stats = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30)
    const recent = transactions.filter((t) => isAfter(new Date(t.createdAt), thirtyDaysAgo))
    const currency = recent.find((t) => t.currency)?.currency || 'usd'
    const grossRevenue = recent
      .filter((t) => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0)
    const totalRefunds = recent
      .filter((t) => t.type === 'refund')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const totalDisputes = recent
      .filter((t) => t.type === 'dispute')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const totalFees = recent
      .filter((t) => t.type === 'processor_fee')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const netRevenue = grossRevenue - totalRefunds - totalDisputes - totalFees
    return {
      currency,
      grossRevenue,
      netRevenue,
      totalRefunds,
      totalDisputes,
      totalFees,
      paymentCount: recent.filter((t) => t.type === 'payment').length,
      uniqueCustomers: new Set(recent.filter((t) => t.customerId).map((t) => t.customerId)).size,
      activeSubscriptions: subscriptions.filter(
        (s) => s.status === 'active' || s.status === 'trialing',
      ).length,
    }
  }, [subscriptions, transactions])

  if (products.length === 0 && transactions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <div className="size-12 rounded-xl bg-muted/50 border grid place-items-center mx-auto mb-4">
            <BadgeDollarSign className="size-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h2 className="text-[15px] font-semibold mb-1">No products yet</h2>
          <p className="text-[13px] text-muted-foreground mb-5">
            Create your first product to start accepting payments.
          </p>
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium btn-elevated-primary hover:bg-primary-hover transition-all duration-100"
          >
            <Plus className="size-3.5" />
            Create Product
          </button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-[1080px] p-5 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Gross Revenue"
            value={formatPrice(stats.grossRevenue, stats.currency)}
            subtitle="Last 30 days"
            icon={BadgeDollarSign}
          />
          <StatCard
            title="Net Revenue"
            value={formatPrice(stats.netRevenue, stats.currency)}
            subtitle="After fees & deductions"
            icon={Receipt}
          />
          <StatCard
            title="Customers"
            value={stats.uniqueCustomers}
            subtitle="Unique buyers"
            icon={Users}
          />
          <StatCard
            title="Active Subs"
            value={stats.activeSubscriptions}
            subtitle="Currently active"
            icon={Repeat}
          />
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-[13px] font-semibold">Recent Activity</h3>
              {transactions.length > 5 && (
                <button className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                  View all <ChevronRight className="size-3" />
                </button>
              )}
            </div>
            {transactions.length > 0 ? (
              <div className="p-1.5 space-y-0.5">
                {transactions.slice(0, 5).map((t) => (
                  <RecentActivityItem key={t.id} transaction={t} />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <Receipt
                  className="size-6 text-muted-foreground/40 mx-auto mb-2"
                  strokeWidth={1.5}
                />
                <p className="text-[13px] text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl border bg-card p-4 self-start">
            <h3 className="text-[13px] font-semibold mb-3">Revenue Breakdown</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[13px] text-muted-foreground">Gross</span>
                </div>
                <span className="text-[13px] font-medium tabular-nums">
                  {formatPrice(stats.grossRevenue, stats.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-amber-500" />
                  <span className="text-[13px] text-muted-foreground">Fees</span>
                </div>
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                  -{formatPrice(stats.totalFees, stats.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-red-500" />
                  <span className="text-[13px] text-muted-foreground">Refunds</span>
                </div>
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                  -{formatPrice(stats.totalRefunds, stats.currency)}
                </span>
              </div>
              {stats.totalDisputes > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-orange-500" />
                    <span className="text-[13px] text-muted-foreground">Disputes</span>
                  </div>
                  <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                    -{formatPrice(stats.totalDisputes, stats.currency)}
                  </span>
                </div>
              )}
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Net</span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {formatPrice(stats.netRevenue, stats.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
