'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBillingCheckout, useSubscription } from '@/hooks/use-subscription'
import {
  Lightning,
  Cube,
  EyeSlash,
  PaperPlaneTilt,
  Storefront,
  Key,
  CircleNotch,
} from '@phosphor-icons/react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

const FEATURES: ReadonlyArray<{
  icon: PhosphorIcon
  title: string
  desc: string
  bg: string
  text: string
}> = [
  {
    icon: Lightning,
    title: '$20/mo AI credits',
    desc: 'Use AI to build, edit, and iterate on your apps',
    bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    text: 'text-amber-600 dark:text-amber-400',
  },
  {
    icon: Cube,
    title: 'Unlimited projects',
    desc: 'Create as many projects as you need, no caps',
    bg: 'bg-violet-500/10 dark:bg-violet-400/10',
    text: 'text-violet-600 dark:text-violet-400',
  },
  {
    icon: EyeSlash,
    title: 'Private projects',
    desc: "Keep your work hidden until you're ready to share",
    bg: 'bg-indigo-500/10 dark:bg-indigo-400/10',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    icon: PaperPlaneTilt,
    title: 'One-click deploy',
    desc: 'Ship to production instantly with your own domain',
    bg: 'bg-blue-500/10 dark:bg-blue-400/10',
    text: 'text-blue-600 dark:text-blue-400',
  },
  {
    icon: Storefront,
    title: 'Sell on marketplace',
    desc: 'List your apps and earn revenue from other users',
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: Key,
    title: 'Bring your own keys',
    desc: 'Use your existing OpenAI, Gemini, or ChatGPT subscription',
    bg: 'bg-orange-500/10 dark:bg-orange-400/10',
    text: 'text-orange-600 dark:text-orange-400',
  },
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
  const isActive = currentTier === 'pro' && currentInterval === interval

  const startCheckout = async () => {
    const url = await checkout.mutateAsync({ interval })
    window.location.href = url
  }

  const monthlyOption = billingOptions.find((o) => o.interval === 'month')
  const yearlyOption = billingOptions.find((o) => o.interval === 'year')
  const yearlySavings =
    monthlyOption && yearlyOption
      ? Math.round(
          ((monthlyOption.priceUsd * 12 - yearlyOption.priceUsd) / (monthlyOption.priceUsd * 12)) *
            100,
        )
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] gap-0 p-0 overflow-hidden border-border/50">
        <DialogTitle className="sr-only">Upgrade to Pro</DialogTitle>

        {/* ── Header ── */}
        <div className="px-8 pt-8 text-center">
          <h2 className="text-[22px] font-bold tracking-tight">Upgrade to Pro</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Everything you need to ship faster
          </p>
        </div>

        {/* ── Plan cards ── */}
        <div className="px-6 pt-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                key: 'month' as const,
                label: 'Monthly',
                price: monthlyOption?.priceUsd ?? null,
                note: null,
              },
              {
                key: 'year' as const,
                label: 'Yearly',
                price: yearlyOption ? Math.round(yearlyOption.priceUsd / 12) : null,
                note: yearlyOption ? `$${yearlyOption.priceUsd}/yr` : null,
              },
            ].map(({ key, label, price, note }) => {
              const selected = interval === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInterval(key)}
                  className={cn(
                    'relative rounded-2xl px-4 py-5 text-center transition-all duration-200',
                    selected
                      ? 'ring-[1.5px] ring-brand bg-brand/5'
                      : 'border border-border/50 hover:border-border',
                  )}
                >
                  {key === 'year' && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold text-brand-foreground uppercase tracking-wider">
                      Best value
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={cn(
                        'text-[12px] font-medium',
                        selected ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                    {key === 'year' && yearlySavings > 0 && (
                      <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-bold text-brand">
                        -{yearlySavings}%
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline justify-center gap-0.5">
                    <span className="text-[32px] font-bold tabular-nums leading-none tracking-tight">
                      ${price ?? '–'}
                    </span>
                    <span className="text-[13px] font-medium text-muted-foreground">/mo</span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground/60">
                    {note ?? 'Billed monthly'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-6 mt-6 border-t border-border/40" />

        {/* ── Features ── */}
        <div className="px-6 pt-5">
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc, bg, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5',
                    bg,
                  )}
                >
                  <Icon weight="duotone" className={cn('size-4', text)} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-tight">{title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="px-6 pt-6 pb-6">
          <Button
            className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-[0_0_24px_rgba(124,58,237,0.2)] hover:shadow-[0_0_32px_rgba(124,58,237,0.3)] transition-shadow duration-300"
            variant="brand"
            disabled={isActive || checkout.isPending}
            onClick={startCheckout}
          >
            {checkout.isPending ? (
              <CircleNotch weight="bold" className="size-4 animate-spin" />
            ) : isActive ? (
              'Current plan'
            ) : (
              'Upgrade to Pro'
            )}
          </Button>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground/50">
            {interval === 'year'
              ? `Billed $${yearlyOption?.priceUsd ?? '–'}/yr · Cancel anytime`
              : 'Renews monthly · Cancel anytime'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
