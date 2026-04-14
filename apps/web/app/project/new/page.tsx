'use client'

import {
  CircleNotch,
  CurrencyDollar,
  EyeSlash,
  Globe,
  Key,
  Lightning,
  Rocket,
  Storefront,
} from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { useCreateProject } from '@/queries/projects'
import { useBillingCheckout, useSubscription } from '@/hooks/use-subscription'

const GH_URL = 'https://github.com/bahodirr/worker-vite-react-simple-template'

const PRO_FEATURES = [
  { label: '$20/mo AI credits included', icon: Lightning, color: '#f59e0b' },
  { label: 'Unlimited projects', icon: Rocket, color: '#3b82f6' },
  { label: 'Private projects', icon: EyeSlash, color: '#8b5cf6' },
  { label: 'One-click deploy with custom domain', icon: Globe, color: '#10b981' },
  { label: 'Sell on marketplace', icon: Storefront, color: '#ec4899' },
  { label: 'Bring your own API keys', icon: Key, color: '#f97316' },
  { label: 'Priority support', icon: CurrencyDollar, color: '#06b6d4' },
]

function readOnboarding() {
  try {
    const r = sessionStorage.getItem('surgent:onboarding')
    if (!r) return undefined
    sessionStorage.removeItem('surgent:onboarding')
    return JSON.parse(r)
  } catch {
    return undefined
  }
}

/* ─── Upgrade page ─── */

function UpgradePage() {
  const router = useRouter()
  const { data } = useSubscription()
  const checkout = useBillingCheckout()
  const [interval, setInterval] = useState<'month' | 'year'>('month')

  const billingOptions = data?.billingOptions ?? []
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
      window.location.href = await checkout.mutateAsync({ interval })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to start checkout')
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-white dark:bg-background">
      <div className="flex-1 overflow-auto flex items-start sm:items-center justify-center px-4 sm:px-6 py-10 sm:py-0">
        <div className="max-w-sm w-full text-center">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Upgrade to Pro
          </h1>
          <p className="text-[13px] sm:text-sm text-muted-foreground/60 mt-2 mb-5 sm:mb-6">
            Unlock AI-powered business briefs and all Pro features
          </p>

          {/* Interval toggle */}
          <div className="inline-flex items-center h-9 rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner mb-6 sm:mb-8">
            {(['month', 'year'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setInterval(key)}
                className={cn(
                  'inline-flex items-center justify-center h-7 px-3 sm:px-4 rounded-md text-[13px] sm:text-sm font-medium transition-all cursor-pointer',
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

          {/* Price */}
          <div className="flex items-baseline justify-center gap-1 mb-1.5">
            <span className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight">
              ${displayPrice ?? '–'}
            </span>
            <span className="text-sm font-medium text-muted-foreground">/mo</span>
          </div>
          <p className="text-xs text-muted-foreground/50 mb-6 sm:mb-8">
            {interval === 'year' ? `Billed $${yearlyOption?.priceUsd ?? '–'}/yr` : 'Billed monthly'}{' '}
            · Cancel anytime
          </p>

          {/* Features */}
          <div className="text-left space-y-2 sm:space-y-2.5 mb-6 sm:mb-8">
            {PRO_FEATURES.map(({ label, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2.5 sm:gap-3">
                <div
                  className="size-7 sm:size-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}12` }}
                >
                  <Icon weight="duotone" className="size-3.5 sm:size-4" style={{ color }} />
                </div>
                <span className="text-[12px] sm:text-[13px] text-foreground/70">{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={startCheckout}
            disabled={checkout.isPending}
            className="w-full h-11 sm:h-12 rounded-full text-[13px] sm:text-sm font-semibold btn-brand cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {checkout.isPending ? (
              <CircleNotch weight="bold" className="size-4 animate-spin" />
            ) : (
              'Upgrade to Pro'
            )}
          </button>
          <button
            onClick={() => router.push('/')}
            className="mt-3 sm:mt-4 text-[12px] sm:text-[13px] text-muted-foreground/40 hover:text-foreground/60 transition-colors cursor-pointer"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ─── */

function Content() {
  const router = useRouter()
  const prompt = useSearchParams().get('prompt') || ''
  const create = useCreateProject()
  const sub = useSubscription()
  const started = useRef(false)
  const [error, setError] = useState('')

  const tier = sub.data?.tier
  const isPro = tier === 'pro'
  const subLoaded = sub.data !== undefined

  useEffect(() => {
    if (started.current) return
    if (!prompt) {
      router.replace('/')
      return
    }
    if (!subLoaded) return
    if (!isPro) return
    started.current = true

    const data = readOnboarding()
    create
      .mutateAsync({
        name: data?.businessName || 'My Project',
        githubUrl: GH_URL,
        initConvex: false,
        metadata: data ? { onboarding: { ...data, prompt } } : undefined,
      })
      .then(({ id }) => {
        track('project_created', { project_id: id })
        router.replace(`/company/${id}/editor?initial=${encodeURIComponent(prompt)}`)
      })
      .catch((err: any) => {
        setError(err?.message || 'Something went wrong. Please try again.')
      })
  }, [prompt, router, create, subLoaded, isPro])

  if (subLoaded && !isPro) return <UpgradePage />

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-white dark:bg-background">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm px-4">
          <p className="text-sm text-foreground/70">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 text-[13px] text-brand hover:underline cursor-pointer"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-white dark:bg-background">
      <div className="absolute top-0 left-0 right-0 h-1 bg-foreground/[0.04]">
        <motion.div
          className="h-full rounded-r-full bg-brand shadow-[0_0_8px_rgba(124,92,252,0.4)]"
          initial={{ width: '0%' }}
          animate={{ width: '60%' }}
          transition={{ duration: 12, ease: 'linear' }}
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="size-8 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
        <p className="text-sm text-muted-foreground/50">Setting up your project...</p>
      </div>
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-white dark:bg-background" />}>
      <Content />
    </Suspense>
  )
}
