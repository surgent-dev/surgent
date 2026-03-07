'use client'

import { use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Geist, Geist_Mono } from 'next/font/google'
import {
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Globe,
  Calendar,
  CreditCard,
  BarChart3,
  Layers,
} from 'lucide-react'
import { Lightning } from '@phosphor-icons/react'
import { useStartupQuery } from '@/queries/startups'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

function fmt(dollars: number): string {
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}k`
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtFull(dollars: number): string {
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function domain(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
    <div className="bg-white/[0.02] p-5 rounded-[20px] border border-white/[0.04]">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="size-8 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/[0.02]">
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
        {sub && <div className="text-[12px] text-muted-foreground/60 font-medium">{sub}</div>}
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
      style={!last ? { borderBottom: '1px solid rgba(255,255,255,0.04)' } : undefined}
    >
      <p className="text-[13px] text-muted-foreground font-medium">{label}</p>
      <div className="text-[13px] text-foreground flex items-center gap-1.5 font-medium">
        {children}
      </div>
    </div>
  )
}

export default function StartupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { data: startup, isLoading, error } = useStartupQuery(slug)

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

  const pageClass = `min-h-screen bg-background ${geist.variable} ${geistMono.variable}`
  const pageStyle = { fontFamily: 'var(--font-geist), system-ui, sans-serif' }

  if (isLoading) {
    return (
      <div className={pageClass} style={pageStyle}>
        <header
          className="w-full px-6 h-14 flex items-center sticky top-0 z-40 bg-background/85 backdrop-blur-sm"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="max-w-6xl mx-auto w-full">
            <div className="h-5 w-24 rounded bg-white/5 animate-pulse" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-2xl bg-white/5 animate-pulse shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-7 w-48 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-64 rounded bg-white/[0.03] animate-pulse" />
            </div>
          </div>
          <div className="h-16 w-full rounded bg-white/[0.03] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[110px] rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (error || !startup) {
    return (
      <div className={`${pageClass} flex items-center justify-center`} style={pageStyle}>
        <div className="text-center">
          <p className="text-[15px] text-[#ccc]" style={{ fontWeight: 550 }}>
            Startup not found
          </p>
          <Link
            href="/inspirations"
            className="text-[13px] text-[#555] hover:text-[#888] mt-2 inline-block transition-colors"
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
      <header
        className="w-full px-6 h-14 flex items-center sticky top-0 z-40 bg-background/85 backdrop-blur-sm"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/">
              <Image
                src="/surgent-logo-dark.svg"
                alt="Surgent"
                width={119}
                height={32}
                className="h-7 w-auto"
                priority
              />
            </Link>
            <span className="text-[#333]">/</span>
            <Link
              href="/inspirations"
              className="text-[13px] text-[#555] hover:text-[#888] transition-colors shrink-0"
              style={{ fontWeight: 500 }}
            >
              Inspirations
            </Link>
            <span className="text-[#333]">/</span>
            <span className="text-[13px] text-[#888] truncate" style={{ fontWeight: 500 }}>
              {startup.name}
            </span>
          </div>
          <Link
            href={`/?initial=${encodeURIComponent(buildPrompt())}`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold text-white shrink-0 ml-4 transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              boxShadow: '0 0 16px rgba(124,58,237,0.25), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <Lightning className="h-3.5 w-3.5" weight="fill" />
            Build This App
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="flex items-start gap-5 mb-8">
          <img
            src={startup.icon!}
            alt=""
            className="h-20 w-20 rounded-[20px] object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/[0.05]"
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
                  {domain(startup.website)}
                  <ArrowUpRight className="h-3 w-3 opacity-50" />
                </a>
              )}
              {startup.category && (
                <>
                  <span className="text-white/10">·</span>
                  <span className="text-muted-foreground">{startup.category}</span>
                </>
              )}
              {startup.country && (
                <>
                  <span className="text-white/10">·</span>
                  <span className="text-muted-foreground">{startup.country}</span>
                </>
              )}
              {startup.xHandle && (
                <>
                  <span className="text-white/10">·</span>
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
            className="text-[14.5px] text-[#888] leading-[1.7] mb-10"
            style={{ letterSpacing: '-0.01em' }}
          >
            {startup.description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          <StatCard
            label="Revenue / mo"
            value={fmt(startup.revenueLast30Days)}
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
            value={fmt(startup.revenueMrr)}
            icon={CreditCard}
            sub={
              startup.activeSubscriptions > 0
                ? `${startup.activeSubscriptions.toLocaleString()} subs`
                : undefined
            }
          />
          <StatCard
            label="Total Revenue"
            value={fmt(startup.revenueTotal)}
            icon={Layers}
            sub="all time"
          />
        </div>

        {/* Details */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-[24px] p-6 mb-10">
          <h2 className="text-[14px] text-foreground mb-4 font-semibold tracking-tight">Details</h2>
          <div>
            <DetailRow label="Founded">
              <Calendar className="h-4 w-4 text-muted-foreground/60" />
              {formatDate(startup.foundedDate)}
            </DetailRow>
            <DetailRow label="Payment provider">
              <CreditCard className="h-4 w-4 text-muted-foreground/60" />
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
          <div
            className="rounded-xl p-6 mb-10 flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: 'rgba(34,160,107,0.05)',
              border: '1px solid rgba(34,160,107,0.12)',
              boxShadow: 'var(--shadow-surface-xs)',
            }}
          >
            <div>
              <p className="text-[13px] text-[#22a06b]" style={{ fontWeight: 600 }}>
                For sale
              </p>
              {startup.askingPrice != null && (
                <p
                  className="text-[22px] text-[#fdf8f0] mt-0.5"
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
                <p className="text-[11px] text-[#555] mt-1">
                  Listed {formatDate(startup.firstListedForSaleAt)}
                </p>
              )}
            </div>
            <a
              href={`https://trustmrr.com/${startup.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white bg-[#22a06b] hover:bg-[#1e9060] transition-colors shrink-0"
              style={{ fontWeight: 550 }}
            >
              View on TrustMRR
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/?initial=${encodeURIComponent(buildPrompt())}`}
            className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl text-[15px] font-semibold transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              color: '#fff',
              boxShadow:
                '0 0 32px rgba(124,58,237,0.3), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Lightning className="h-[18px] w-[18px]" weight="fill" />
            Build This App
          </Link>
          <div className="flex gap-3">
            {startup.website && (
              <a
                href={startup.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-[13px] text-muted-foreground font-medium hover:text-foreground hover:bg-white/[0.04] transition-all"
              >
                <Globe className="h-3.5 w-3.5" />
                Visit Website
                <ArrowUpRight className="h-3 w-3 opacity-40" />
              </a>
            )}
            <a
              href={`https://trustmrr.com/${startup.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-[13px] text-muted-foreground font-medium hover:text-foreground hover:bg-white/[0.04] transition-all"
            >
              View on TrustMRR
              <ArrowUpRight className="h-3 w-3 opacity-40" />
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
