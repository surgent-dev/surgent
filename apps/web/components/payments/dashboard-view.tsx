'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { BadgeDollarSign, ChevronRight, Plus, Receipt, Repeat, Users } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  formatPrice,
  formatTransactionType,
  getTransactionIcon,
  getTransactionColor,
} from './utils'
import { getPaymentSummary } from './summary'
import type { ProductWithPrices } from '@/queries/products'
import type { Transaction } from '@/queries/transactions'
import type { Subscription } from '@/queries/subscriptions'

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-sm hover:border-border/80">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <div className={cn('size-7 rounded-lg grid place-items-center', accent || 'bg-muted/50')}>
          <Icon className="size-3.5 text-foreground/60" strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight leading-none">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
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
  subscriptions: Subscription[]
  onCreateProduct: () => void
}

export function DashboardView({
  products,
  transactions,
  subscriptions,
  onCreateProduct,
}: DashboardViewProps) {
  const stats = useMemo(
    () => getPaymentSummary(transactions, subscriptions),
    [subscriptions, transactions],
  )

  if (products.length === 0 && transactions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <div className="size-10 rounded-lg bg-muted/50 border grid place-items-center mx-auto mb-3">
            <BadgeDollarSign className="size-4.5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold mb-1">No products yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first product to start accepting payments.
          </p>
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium btn-elevated-primary hover:bg-primary-hover transition-all duration-100"
          >
            <Plus className="size-3.5" />
            Create Product
          </button>
          <p className="text-xs text-muted-foreground/60 mt-4">
            <span className="font-medium text-muted-foreground/80">Tip:</span> Ask AI to integrate
            payments into your app
          </p>
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
            accent="bg-emerald-500/10"
          />
          <StatCard
            title="Net Revenue"
            value={formatPrice(stats.netRevenue, stats.currency)}
            subtitle="After fees & deductions"
            icon={Receipt}
            accent="bg-blue-500/10"
          />
          <StatCard
            title="Customers"
            value={stats.uniqueCustomers}
            subtitle="Unique buyers"
            icon={Users}
            accent="bg-violet-500/10"
          />
          <StatCard
            title="Active Subs"
            value={stats.activeSubscriptions}
            subtitle="Currently active"
            icon={Repeat}
            accent="bg-amber-500/10"
          />
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Recent Activity</h3>
              {transactions.length > 5 && (
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                  View all <ChevronRight className="size-3" />
                </button>
              )}
            </div>
            {transactions.length > 0 ? (
              <div className="p-2 space-y-1">
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
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl border bg-card self-start overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Revenue Breakdown</h3>
            </div>
            <div className="p-4 space-y-3">
              {/* Stacked bar */}
              {stats.grossRevenue > 0 && (
                <div className="h-3 rounded-full bg-muted/40 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 rounded-l-full transition-all duration-500"
                    style={{
                      width: `${Math.max(((stats.grossRevenue - stats.totalFees - stats.totalRefunds - stats.totalDisputes) / stats.grossRevenue) * 100, 0)}%`,
                    }}
                  />
                  {stats.totalFees > 0 && (
                    <div
                      className="bg-amber-400 transition-all duration-500"
                      style={{ width: `${(stats.totalFees / stats.grossRevenue) * 100}%` }}
                    />
                  )}
                  {stats.totalRefunds > 0 && (
                    <div
                      className="bg-red-400 transition-all duration-500"
                      style={{ width: `${(stats.totalRefunds / stats.grossRevenue) * 100}%` }}
                    />
                  )}
                  {stats.totalDisputes > 0 && (
                    <div
                      className="bg-orange-400 rounded-r-full transition-all duration-500"
                      style={{ width: `${(stats.totalDisputes / stats.grossRevenue) * 100}%` }}
                    />
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-[3px] bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">Gross Revenue</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(stats.grossRevenue, stats.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-[3px] bg-amber-400" />
                    <span className="text-xs text-muted-foreground">Fees</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    -{formatPrice(stats.totalFees, stats.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-[3px] bg-red-400" />
                    <span className="text-xs text-muted-foreground">Refunds</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    -{formatPrice(stats.totalRefunds, stats.currency)}
                  </span>
                </div>
                {stats.totalDisputes > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-[3px] bg-orange-400" />
                      <span className="text-xs text-muted-foreground">Disputes</span>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      -{formatPrice(stats.totalDisputes, stats.currency)}
                    </span>
                  </div>
                )}
              </div>

              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Net Revenue</span>
                <span className="text-base font-bold tabular-nums tracking-tight">
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
