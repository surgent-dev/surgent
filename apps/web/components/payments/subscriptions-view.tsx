'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  ChevronDown,
  Filter,
  Loader2,
  MoreHorizontal,
  Repeat,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Subscription } from '@/queries/subscriptions'
import { useCancelSubscription } from '@/queries/subscriptions'

type StatusFilter = 'all' | 'active' | 'canceled'

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'bg-emerald-500/10 text-emerald-600'
    case 'canceled':
    case 'expired':
      return 'bg-red-500/10 text-red-500'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function SubscriptionRow({
  subscription,
  onCancel,
  isCanceling,
}: {
  subscription: Subscription
  onCancel: (id: string) => void
  isCanceling: boolean
}) {
  const isActive = subscription.status === 'active' || subscription.status === 'trialing'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="size-8 rounded-lg bg-muted/50 grid place-items-center">
        <Repeat className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
        <div className="min-w-0">
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium capitalize',
              getStatusColor(subscription.status),
            )}
          >
            {subscription.status}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground truncate font-mono">
            {subscription.customerId ? `${subscription.customerId.slice(0, 8)}...` : 'No customer'}
          </p>
        </div>
        <div className="text-center">
          {subscription.currentPeriodStart && subscription.currentPeriodEnd ? (
            <p className="text-[12px] text-muted-foreground">
              {format(new Date(subscription.currentPeriodStart), 'MMM d')} &rarr;{' '}
              {format(new Date(subscription.currentPeriodEnd), 'MMM d')}
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground/50">&mdash;</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <p className="text-[12px] text-muted-foreground">
            {format(new Date(subscription.createdAt), 'MMM d, yyyy')}
          </p>
          {isActive && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-muted/50 rounded transition-colors">
                  <MoreHorizontal className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onCancel(subscription.id)}
                  disabled={isCanceling}
                  className="text-red-600 focus:text-red-600"
                >
                  <XCircle className="size-3.5 mr-2" />
                  Cancel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}

interface SubscriptionsViewProps {
  subscriptions: Subscription[]
  isLoading: boolean
  projectId: string
}

export function SubscriptionsView({ subscriptions, isLoading, projectId }: SubscriptionsViewProps) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const cancelMutation = useCancelSubscription(projectId)

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => {
      if (filter === 'active' && s.status !== 'active' && s.status !== 'trialing') return false
      if (filter === 'canceled' && s.status !== 'canceled' && s.status !== 'expired') return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          s.id.toLowerCase().includes(query) ||
          s.customerId?.toLowerCase().includes(query) ||
          s.processorSubscriptionId?.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [subscriptions, filter, searchQuery])

  const handleCancel = (id: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return
    setCancelingId(id)
    cancelMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Subscription canceled')
        setCancelingId(null)
      },
      onError: () => {
        toast.error('Failed to cancel subscription')
        setCancelingId(null)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-2 px-5 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[13px] bg-transparent border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted/60 rounded transition-colors"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 px-2.5 text-[13px] border rounded-lg hover:bg-muted/30 transition-colors">
                <Filter className="size-3 text-muted-foreground" />
                {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Canceled'}
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>All Status</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilter('active')}>Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('canceled')}>Canceled</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredSubscriptions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="size-12 rounded-xl bg-muted/50 border grid place-items-center mx-auto mb-4">
              <Repeat className="size-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-[15px] font-semibold mb-1">
              {subscriptions.length === 0 ? 'No subscriptions yet' : 'No results'}
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {subscriptions.length === 0
                ? 'Subscriptions appear when customers purchase recurring products'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-[1080px] p-5">
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {filteredSubscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  onCancel={handleCancel}
                  isCanceling={cancelingId === subscription.id}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
