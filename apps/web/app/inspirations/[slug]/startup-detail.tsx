'use client'

import { Lightning } from '@phosphor-icons/react'
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  CreditCard,
  Globe,
  Layers,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Geist, Geist_Mono } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SurgentLogo } from '@/components/surgent-logo'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { formatMonthYear } from '@/lib/format'
import { passthroughImageLoader } from '@/lib/image-loader'
import { formatRevenueCompact, getDomainFromUrl } from '@/lib/inspirations'
import { type Startup, useStartupQuery } from '@/queries/startups'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

const NAV_LINK =
  'font-display text-[0.9rem] font-medium text-[#1d1c22] dark:text-foreground transition-all px-4 py-2 rounded-full hover:bg-[#1d1c220d]'

function fmtFull(dollars: number): string {
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string | React.ReactNode
  sub?: string | React.ReactNode
  icon: React.ElementType
}) {
  return (
    <div className="bg-[var(--page-panel)] p-5 rounded-[20px] border border-[var(--page-line)]">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="size-8 rounded-xl bg-[var(--page-panel-strong)] flex items-center justify-center border border-[var(--page-line-soft)]">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-[13px] text-muted-foreground font-medium tracking-tight">{label}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div
          className="text-[26px] text-foreground leading-none tracking-tighter"
          style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 650 }}
        >
          {value}
        </div>
        {sub && <div className="text-[12px] text-[var(--page-muted-soft)] font-medium">{sub}</div>}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="flex items-center justify-between py-3.5"
      style={!last ? { borderBottom: '1px solid var(--page-line-soft)' } : undefined}
    >
      <p className="text-[13px] text-muted-foreground font-medium">{label}</p>
      <div className="text-[13px] text-foreground flex items-center gap-1.5 font-medium">
        {children}
      </div>
    </div>
  )
}

type StartupDetailPageProps = {
  slug: string
  initialStartup: Startup
}

export default function StartupDetailPage({ slug, initialStartup }: StartupDetailPageProps) {
  const startupQuery = useStartupQuery(slug)
  const startup = startupQuery.data ?? initialStartup
  const isLoading = startupQuery.isLoading && !startupQuery.data && !initialStartup
  const error = startupQuery.error
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    authClient.getSession().then(({ data }) => setLoggedIn(!!data?.user))
  }, [])
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function buildPrompt() {
    if (!startup) return ''
    const lines = [
      `Build an MVP clone of ${startup.name}${startup.website ? ` (${startup.website})` : ''}.`,
      '',
      startup.description ? `What it does: ${startup.description}` : '',
      startup.category ? `Category: ${startup.category}` : '',
      '',
      'Research the product, understand its core value proposition, and build a functional MVP with the key features that make it work. Focus on the core user flow — skip nice-to-haves like auth, billing, and admin panels. The UI must feel modern and premium — clean layout, refined typography, smooth interactions, and polished aesthetics.',
    ]
    return lines.filter(Boolean).join('\n')
  }

  const pageClass = `min-h-screen bg-[#f5f5f7] dark:bg-background text-foreground ${geist.variable} ${geistMono.variable}`
  const pageStyle: React.CSSProperties & Record<`--${string}`, string> = {
    fontFamily: 'var(--font-geist), system-ui, sans-serif',
    '--page-header': 'color-mix(in srgb, var(--background) 84%, transparent)',
    '--page-panel': 'color-mix(in srgb, var(--card) 94%, transparent)',
    '--page-panel-strong': 'color-mix(in srgb, var(--card) 98%, transparent)',
    '--page-line': 'color-mix(in srgb, var(--border) 70%, transparent)',
    '--page-line-soft': 'color-mix(in srgb, var(--border) 50%, transparent)',
    '--page-muted-soft': 'color-mix(in srgb, var(--muted-foreground) 75%, transparent)',
  }

  if (isLoading) {
    return (
      <div className={pageClass} style={pageStyle}>
        <header className="sticky top-0 z-50 px-4 sm:px-8 pt-4 pb-2 transition-all duration-300">
          <div className="flex items-center justify-between w-full mx-auto max-w-5xl px-3 py-2.5">
            <Link href="/" className="pl-3">
              <SurgentLogo className="text-[1.5rem]" />
            </Link>
            <div className="h-5 w-24 rounded bg-[var(--page-panel)] animate-pulse" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-2xl bg-[var(--page-panel)] animate-pulse shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-7 w-48 rounded bg-[var(--page-panel)] animate-pulse" />
              <div className="h-4 w-64 rounded bg-[var(--page-panel-strong)] animate-pulse" />
            </div>
          </div>
          <div className="h-16 w-full rounded bg-[var(--page-panel-strong)] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[110px] rounded-xl bg-[var(--page-panel-strong)] animate-pulse"
              />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (error && !startup) {
    return (
      <div className={`${pageClass} flex items-center justify-center`} style={pageStyle}>
        <div className="text-center">
          <p className="text-[15px] text-foreground" style={{ fontWeight: 550 }}>
            Startup not found
          </p>
          <Link
            href="/inspirations"
            className="text-[13px] text-muted-foreground hover:text-foreground mt-2 inline-block transition-colors"
          >
            Back to Inspirations
          </Link>
        </div>
      </div>
    )
  }

  const hasGrowth = startup.growth30d != null && startup.growth30d > 0
  const hasNegGrowth = startup.growth30d != null && startup.growth30d < 0

  return (
    <div className={pageClass} style={pageStyle}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 pt-4 pb-2 transition-all duration-300">
        <div
          className={`flex items-center justify-between w-full mx-auto transition-all duration-300 ease-out ${scrolled ? 'max-w-3xl border border-[#1d1c220d] dark:border-border/20 bg-[#f5f5f7]/85 dark:bg-card/85 backdrop-blur-2xl rounded-full px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]' : 'max-w-5xl px-3 py-2.5'}`}
        >
          <Link href="/" className="pl-3">
            <SurgentLogo className="text-[1.5rem]" />
          </Link>
          <nav className="hidden sm:flex items-center gap-0">
            <Link href="/" className={NAV_LINK}>
              Home
            </Link>
            <Link href="/inspirations" className={NAV_LINK}>
              Inspirations
            </Link>
            <Link href="/marketplace" className={NAV_LINK}>
              Marketplace
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="btn-brand inline-flex items-center h-9 px-5 rounded-full font-display text-[0.9rem] font-medium cursor-pointer"
              >
                Dashboard
              </Link>
            ) : loggedIn === false ? (
              <>
                <Link
                  href="/login"
                  className="btn-brand-secondary inline-flex items-center h-9 px-4 rounded-full font-display text-[0.9rem] font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="btn-brand inline-flex items-center h-9 px-5 rounded-full font-display text-[0.9rem] font-medium cursor-pointer"
                >
                  Sign up
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="flex items-start gap-5 mb-8">
          <Image
            loader={passthroughImageLoader}
            unoptimized
            src={startup.icon!}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 rounded-[20px] object-cover shrink-0 border border-[var(--page-line)]"
            style={{ boxShadow: 'var(--shadow-surface-xs)' }}
          />
          <div className="flex-1">
            <h1
              className="text-[28px] sm:text-[32px] text-foreground mb-2"
              style={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15 }}
            >
              {startup.name}
            </h1>
            <div className="flex items-center gap-2.5 flex-wrap text-[13px] font-medium">
              {startup.website && (
                <a
                  href={startup.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {getDomainFromUrl(startup.website)}
                  <ArrowUpRight className="h-3 w-3 opacity-50" />
                </a>
              )}
              {startup.category && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-muted-foreground">{startup.category}</span>
                </>
              )}
              {startup.country && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-muted-foreground">{startup.country}</span>
                </>
              )}
              {startup.xHandle && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <a
                    href={`https://x.com/${startup.xHandle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    @{startup.xHandle}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {startup.description && (
          <p
            className="text-[14.5px] text-muted-foreground leading-[1.7] mb-10"
            style={{ letterSpacing: '-0.01em' }}
          >
            {startup.description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          <StatCard
            label="Revenue / mo"
            value={formatRevenueCompact(startup.revenueLast30Days)}
            icon={BarChart3}
            sub={
              hasGrowth
                ? `+${startup.growth30d!.toFixed(0)}% growth`
                : hasNegGrowth
                  ? `${startup.growth30d!.toFixed(0)}%`
                  : undefined
            }
          />
          <StatCard
            label="MRR"
            value={formatRevenueCompact(startup.revenueMrr)}
            icon={CreditCard}
            sub={
              startup.activeSubscriptions > 0
                ? `${startup.activeSubscriptions.toLocaleString()} subs`
                : undefined
            }
          />
          <StatCard
            label="Total Revenue"
            value={formatRevenueCompact(startup.revenueTotal)}
            icon={Layers}
            sub="all time"
          />
        </div>

        {/* Details */}
        <div className="bg-[var(--page-panel)] border border-[var(--page-line)] rounded-[24px] p-6 mb-10">
          <h2 className="text-[14px] text-foreground mb-4 font-semibold tracking-tight">Details</h2>
          <div>
            <DetailRow label="Founded">
              <Calendar className="h-4 w-4 text-[var(--page-muted-soft)]" />
              {formatMonthYear(startup.foundedDate)}
            </DetailRow>
            <DetailRow label="Payment provider">
              <CreditCard className="h-4 w-4 text-[var(--page-muted-soft)]" />
              <span className="capitalize">{startup.paymentProvider || '—'}</span>
            </DetailRow>
            <DetailRow label="Audience">
              <span className="capitalize">{startup.targetAudience || '—'}</span>
            </DetailRow>
            <DetailRow
              label="Growth (30d)"
              last={startup.profitMarginLast30Days == null && startup.multiple == null}
            >
              <span
                className={hasGrowth ? 'text-emerald-500' : hasNegGrowth ? 'text-rose-500' : ''}
              >
                {hasGrowth && <TrendingUp className="h-4 w-4 inline mr-1.5" />}
                {hasNegGrowth && <TrendingDown className="h-4 w-4 inline mr-1.5" />}
                {startup.growth30d != null
                  ? `${startup.growth30d >= 0 ? '+' : ''}${startup.growth30d.toFixed(1)}%`
                  : '—'}
              </span>
            </DetailRow>
            {startup.profitMarginLast30Days != null && (
              <DetailRow label="Profit margin" last={startup.multiple == null}>
                {startup.profitMarginLast30Days}%
              </DetailRow>
            )}
            {startup.multiple != null && (
              <DetailRow label="Multiple" last>
                {startup.multiple.toFixed(1)}x
              </DetailRow>
            )}
          </div>
        </div>

        {/* For sale */}
        {startup.onSale && (
          <div className="rounded-xl p-6 mb-10 flex items-center justify-between gap-4 flex-wrap border border-emerald-500/15 bg-emerald-500/5">
            <div>
              <p className="text-[13px] text-emerald-600 dark:text-emerald-400 font-semibold">
                For sale
              </p>
              {startup.askingPrice != null && (
                <p
                  className="text-[22px] text-foreground mt-0.5"
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {fmtFull(startup.askingPrice)}
                </p>
              )}
              {startup.firstListedForSaleAt && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Listed {formatMonthYear(startup.firstListedForSaleAt)}
                </p>
              )}
            </div>
            <Button
              size="sm"
              className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              asChild
            >
              <a href={`https://trustmrr.com/${startup.slug}`} target="_blank" rel="noreferrer">
                View on TrustMRR
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Button
            variant="brand"
            size="lg"
            className="w-full h-12 rounded-xl text-[15px] gap-2.5"
            asChild
          >
            <Link href={`/?initial=${encodeURIComponent(buildPrompt())}`}>
              <Lightning className="h-[18px] w-[18px]" weight="fill" />
              Build This App
            </Link>
          </Button>
          {startup.website && (
            <a
              href={startup.website}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 py-1"
            >
              <Globe className="h-3.5 w-3.5" />
              Visit Website
              <ArrowUpRight className="h-3 w-3 opacity-40" />
            </a>
          )}
        </div>

        {/* Source */}
        <p className="text-center text-[11px] text-muted-foreground/50 mt-10 pb-4">
          Data from{' '}
          <a
            href={`https://trustmrr.com/${startup.slug}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            TrustMRR
          </a>
        </p>
      </main>
    </div>
  )
}
