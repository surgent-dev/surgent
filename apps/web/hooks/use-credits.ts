import { useState } from 'react'
import { useCustomer } from 'autumn-js/react'
import { toast } from 'react-hot-toast'

const INTERVAL_LABELS: Record<string, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
}

export function useCredits() {
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const ctx = useCustomer({ swrConfig: { refreshInterval: 30_000 } })
  const feature = ctx.customer?.features?.['ai_credits']

  const balance = feature?.balance ?? 0
  const total = feature?.included_usage ?? 0
  const used = Math.max(total - balance, 0)
  const usedPercent = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const unlimited = feature?.unlimited ?? false
  const remaining = total > 0 ? Math.max((balance / total) * 100, 0) : 0

  // Determine if user is on the highest plan (no upgrade available)
  const activeProduct = ctx.customer?.products?.find(
    (p: { status: string; is_add_on: boolean; is_default: boolean }) =>
      p.status === 'active' && !p.is_add_on && !p.is_default,
  )
  const isMaxPlan =
    activeProduct?.id?.toLowerCase().includes('max') ||
    activeProduct?.name?.toLowerCase().includes('max') ||
    activeProduct?.group?.toLowerCase().includes('max') ||
    false

  const nextResetAt = feature?.next_reset_at
    ? feature.next_reset_at < 10_000_000_000
      ? feature.next_reset_at * 1000
      : feature.next_reset_at
    : null
  const resetAtLabel = nextResetAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(nextResetAt)
    : null
  const renewLabel = feature?.interval ? (INTERVAL_LABELS[feature.interval] ?? null) : null
  const hoursUntilRenew = nextResetAt
    ? Math.max(0, Math.round((nextResetAt - Date.now()) / 3_600_000))
    : null

  const gate = () => {
    if (ctx.isLoading || !ctx.customer) return true
    const { data } = ctx.check({ featureId: 'ai_credits' })
    if (data.allowed) return true
    toast.error('You have run out of AI credits. Please upgrade your plan.', {
      position: 'top-right',
    })
    setPlanDialogOpen(true)
    return false
  }

  return {
    balance,
    total,
    used,
    usedPercent,
    unlimited,
    remaining,
    resetAtLabel,
    renewLabel,
    hoursUntilRenew,
    hasCustomer: !!ctx.customer,
    isMaxPlan,
    gate,
    planDialogOpen,
    setPlanDialogOpen,
    openBillingPortal: () => void ctx.openBillingPortal(),
  }
}
