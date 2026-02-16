'use client'

import { format } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Loader2, Receipt, Repeat } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatPrice } from './utils'
import { useCustomerDetail, type Customer } from '@/queries/customers'

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'bg-emerald-500/10 text-emerald-600'
    case 'canceled':
    case 'expired':
      return 'bg-red-500/10 text-red-600'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

interface CustomerDetailSheetProps {
  customer: Customer | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomerDetailSheet({
  customer,
  projectId,
  open,
  onOpenChange,
}: CustomerDetailSheetProps) {
  const { data: detail, isLoading } = useCustomerDetail(customer?.id, projectId)

  const initial = (customer?.name?.[0] || customer?.email?.[0] || '?').toUpperCase()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">{initial}</span>
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-left truncate">{customer?.name || 'No name'}</SheetTitle>
              <p className="text-sm text-muted-foreground truncate">
                {customer?.email || 'No email'}
              </p>
            </div>
          </div>
          {customer?.externalId && (
            <code className="text-xs text-muted-foreground font-mono mt-2 block">
              ID: {customer.externalId}
            </code>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-6 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <section>
                <h3 className="text-sm font-semibold mb-3">Subscriptions</h3>
                {detail?.subscriptions && detail.subscriptions.length > 0 ? (
                  <div className="space-y-2">
                    {detail.subscriptions.map((sub) => (
                      <div key={sub.id} className="rounded-lg border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Repeat className="size-3.5 text-muted-foreground" />
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                getStatusColor(sub.status),
                              )}
                            >
                              {sub.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sub.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        {sub.currentPeriodStart && sub.currentPeriodEnd && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sub.currentPeriodStart), 'MMM d')} &rarr;{' '}
                            {format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <Repeat
                      className="size-5 text-muted-foreground/50 mx-auto mb-1.5"
                      strokeWidth={1.5}
                    />
                    <p className="text-xs text-muted-foreground">No subscriptions</p>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-3">Transactions</h3>
                {detail?.transactions && detail.transactions.length > 0 ? (
                  <div className="space-y-1">
                    {detail.transactions.map((txn) => {
                      const isPayment = txn.type === 'payment'
                      const Icon = isPayment ? ArrowDownRight : ArrowUpRight
                      const colorClass = isPayment ? 'text-emerald-500' : 'text-red-500'
                      const bgClass = isPayment ? 'bg-emerald-500/10' : 'bg-red-500/10'

                      return (
                        <div key={txn.id} className="flex items-center gap-3 py-2">
                          <div className={cn('rounded-lg p-1.5', bgClass)}>
                            <Icon className={cn('size-3.5', colorClass)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">{txn.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(txn.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <p className={cn('text-sm font-semibold tabular-nums', colorClass)}>
                            {isPayment ? '+' : '-'}
                            {formatPrice(Math.abs(txn.amount), txn.currency)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <Receipt
                      className="size-5 text-muted-foreground/50 mx-auto mb-1.5"
                      strokeWidth={1.5}
                    />
                    <p className="text-xs text-muted-foreground">No transactions</p>
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
