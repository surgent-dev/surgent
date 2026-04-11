'use client'

import {
  CircleNotch,
  CurrencyDollar,
  Eye,
  EyeSlash,
  Globe,
  Key,
  Lightning,
  Rocket,
  Storefront,
  Users,
  Cube,
  Sparkle,
  type Icon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useBillingCheckout, useSubscription } from '@/hooks/use-subscription'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'

const FREE_FEATURES: { label: string; icon: Icon; color: string }[] = [
  { label: '1 project', icon: Cube, color: '#737373' },
  { label: 'Community support', icon: Users, color: '#737373' },
  { label: 'Basic AI usage', icon: Sparkle, color: '#737373' },
  { label: 'Public projects only', icon: Eye, color: '#737373' },
]

const PRO_FEATURES: { label: string; icon: Icon; color: string }[] = [
  { label: '$20/mo AI credits included', icon: Lightning, color: '#f59e0b' },
  { label: 'Unlimited projects', icon: Rocket, color: '#3b82f6' },
  { label: 'Private projects', icon: EyeSlash, color: '#8b5cf6' },
  { label: 'One-click deploy with custom domain', icon: Globe, color: '#10b981' },
  { label: 'Sell on marketplace', icon: Storefront, color: '#ec4899' },
  { label: 'Bring your own API keys', icon: Key, color: '#f97316' },
  { label: 'Priority support', icon: CurrencyDollar, color: '#06b6d4' },
]

interface PlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PlanDialog({ open, onOpenChange }: PlanDialogProps) {
  const { data } = useSubscription()
  const checkout = useBillingCheckout()
  const [interval, setInterval] = useState<'month' | 'year'>('year')

  const billingOptions = data?.billingOptions ?? []
  const currentTier = data?.tier ?? 'free'
  const currentInterval = data?.interval ?? null
  const isProActive = currentTier === 'pro' && currentInterval === interval

  const monthlyOption = billingOptions.find((o) => o.interval === 'month')
  const yearlyOption = billingOptions.find((o) => o.interval === 'year')
  const yearlySavings =
    monthlyOption && yearlyOption
      ? Math.round(
          ((monthlyOption.priceUsd * 12 - yearlyOption.priceUsd) / (monthlyOption.priceUsd * 12)) *
            100,
        )
      : 0

  const displayPrice =
    interval === 'year'
      ? yearlyOption
        ? Math.round(yearlyOption.priceUsd / 12)
        : null
      : (monthlyOption?.priceUsd ?? null)

  const startCheckout = async () => {
    try {
      const selected = billingOptions.find((o) => o.interval === interval)
      track('begin_checkout', {
        currency: 'USD',
        value: selected?.priceUsd ?? 0,
        items: [{ item_id: interval, item_name: `Pro ${interval}ly` }],
      })
      const url = await checkout.mutateAsync({ interval })
      window.location.href = url
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start checkout'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] gap-0 p-0 overflow-hidden border-border/50">
        <DialogTitle className="sr-only">Choose your plan</DialogTitle>

        {/* Header */}
        <div className="px-6 pt-7 sm:px-8 sm:pt-8 text-center">
          <h2 className="font-display text-2xl text-foreground">Choose your plan</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            Start free, upgrade when you&apos;re ready
          </p>

          {/* Billing toggle */}
          <div className="mt-5 inline-flex items-center h-9 rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner">
            {(['month', 'year'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setInterval(key)}
                className={cn(
                  'inline-flex items-center justify-center h-7 px-4 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer',
                  interval === key
                    ? 'bg-background dark:bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {key === 'month' ? 'Monthly' : 'Yearly'}
                {key === 'year' && yearlySavings > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold tabular-nums text-brand bg-brand/10 rounded-full px-1.5 py-0.5">
                    -{yearlySavings}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans side by side */}
        <div className="px-6 pt-6 pb-7 sm:px-8 sm:pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free Plan */}
            <div
              className={cn(
                'rounded-2xl border px-5 py-6 flex flex-col',
                currentTier === 'free' ? 'border-foreground/20 bg-muted/20' : 'border-border/50',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Free</h3>
                {currentTier === 'free' && (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium">
                    Current
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-0.5">
                <span className="text-[36px] font-bold tabular-nums leading-none tracking-tight">
                  $0
                </span>
                <span className="text-sm font-medium text-muted-foreground">/mo</span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">Get started and explore for free</p>

              <div className="mt-6 flex-1 space-y-2.5">
                {FREE_FEATURES.map(({ label, icon: FIcon, color }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div
                      className="size-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <FIcon weight="duotone" className="size-3.5" style={{ color }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="mt-6 w-full h-10 rounded-xl text-xs font-medium cursor-pointer"
                disabled
              >
                {currentTier === 'free' ? 'Current plan' : 'Downgrade'}
              </Button>
            </div>

            {/* Pro Plan */}
            <div
              className={cn(
                'rounded-2xl border px-5 py-6 flex flex-col relative',
                currentTier === 'pro'
                  ? 'border-brand/40 bg-brand/[0.03]'
                  : 'border-brand/30 bg-brand/[0.02]',
              )}
            >
              {interval === 'year' && yearlySavings > 0 && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-brand-foreground uppercase tracking-wider">
                  Best value
                </span>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pro</h3>
                {currentTier === 'pro' && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
                    Current
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-0.5">
                <span className="text-[36px] font-bold tabular-nums leading-none tracking-tight">
                  ${displayPrice ?? '–'}
                </span>
                <span className="text-sm font-medium text-muted-foreground">/mo</span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {interval === 'year'
                  ? `Billed $${yearlyOption?.priceUsd ?? '–'}/yr`
                  : 'Billed monthly'}
              </p>

              <div className="mt-6 flex-1 space-y-2.5">
                {PRO_FEATURES.map(({ label, icon: PIcon, color }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div
                      className="size-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <PIcon weight="duotone" className="size-3.5" style={{ color }} />
                    </div>
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>

              <Button
                className="mt-6 w-full h-10 rounded-xl text-xs font-semibold shadow-[0_0_24px_rgba(124,58,237,0.15)] hover:shadow-[0_0_32px_rgba(124,58,237,0.25)] transition-shadow duration-300 cursor-pointer"
                variant="brand"
                disabled={isProActive || checkout.isPending}
                onClick={startCheckout}
              >
                {checkout.isPending ? (
                  <CircleNotch weight="bold" className="size-4 animate-spin" />
                ) : isProActive ? (
                  'Current plan'
                ) : (
                  'Upgrade to Pro'
                )}
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
            Cancel anytime · No questions asked
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
