import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useBillingPortal, useSubscription } from './use-subscription'

const INTERVAL_LABELS: Record<string, string> = {
  month: 'monthly',
  year: 'yearly',
}

const MONEY_SCALE = 100_000_000

function microsToUsd(value: number) {
  return value / MONEY_SCALE
}

export function useCredits() {
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [topupDialogOpen, setTopupDialogOpen] = useState(false)
  const subscription = useSubscription()
  const portal = useBillingPortal()
  const snapshot = subscription.data

  const balance = microsToUsd(snapshot?.totalBalanceMicros ?? 0)
  const total = microsToUsd(snapshot?.totalBudgetMicros ?? 0)
  const used = Math.max(total - balance, 0)
  const byokProviderCost = microsToUsd(snapshot?.byokProviderCostMicros ?? 0)
  const usedPercent = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const unlimited = false
  const remaining = total > 0 ? Math.max((balance / total) * 100, 0) : 0

  const nextResetAt = snapshot?.nextResetAt ? Date.parse(snapshot.nextResetAt) : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!nextResetAt) return
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [nextResetAt])

  const resetAtLabel = nextResetAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(nextResetAt)
    : null
  const renewLabel = snapshot?.interval ? (INTERVAL_LABELS[snapshot.interval] ?? null) : null
  const hoursUntilRenew = nextResetAt
    ? Math.max(0, Math.round((nextResetAt - now) / 3_600_000))
    : null

  const gate = () => {
    if (subscription.isLoading || !snapshot) return true
    if (snapshot.features.canUseAi) return true
    if (snapshot.tier === 'pro') {
      toast.error('You have run out of usage balance. Please add more balance.', {})
      setTopupDialogOpen(true)
    } else {
      toast.error('You have run out of usage balance. Please upgrade or add more balance.', {})
      setPlanDialogOpen(true)
    }
    return false
  }

  return {
    balance,
    total,
    used,
    byokProviderCost,
    usedPercent,
    unlimited,
    remaining,
    resetAtLabel,
    renewLabel,
    hoursUntilRenew,
    hasCustomer: Boolean(snapshot),
    snapshot,
    gate,
    planDialogOpen,
    setPlanDialogOpen,
    topupDialogOpen,
    setTopupDialogOpen,
    openBalanceDialog: () => {
      if (snapshot?.tier === 'pro') setTopupDialogOpen(true)
      else setPlanDialogOpen(true)
    },
    openBillingPortal: async () => {
      if (!snapshot?.stripeCustomerId && snapshot?.tier === 'free') {
        setPlanDialogOpen(true)
        return
      }

      try {
        const url = await portal.mutateAsync(undefined)
        window.location.href = url
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to open billing portal'
        toast.error(message)
      }
    },
  }
}
