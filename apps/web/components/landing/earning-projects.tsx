'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { useStartupsQuery } from '@/queries/startups'

function fmt(dollars: number): string {
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}k`
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function screenshotUrl(website: string): string {
  return `https://image.thum.io/get/width/800/crop/500/noanimate/${website}`
}

const BENTO = [
  'col-span-1',
  'col-span-1 sm:col-span-2',
  'col-span-1',
  'col-span-1',
  'col-span-1 sm:col-span-2',
  'col-span-1',
  'col-span-1',
  'col-span-1',
  'col-span-1 sm:col-span-2',
  'col-span-1',
  'col-span-1 sm:col-span-2',
  'col-span-1',
  'col-span-1',
  'col-span-1',
  'col-span-1 sm:col-span-2',
  'col-span-1',
  'col-span-1 sm:col-span-2',
  'col-span-1',
]

function ScreenshotImage({ website, name }: { website: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed || !website) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center">
        <span className="text-muted-foreground/30 text-[11px]" style={{ fontWeight: 500 }}>
          {name}
        </span>
      </div>
    )
  }

  return (
    <img
      src={screenshotUrl(website)}
      alt={`${name} screenshot`}
      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function LandingEarningProjects() {
  const { data } = useStartupsQuery({
    perPage: 18,
    sort: 'revenue-desc',
    minRevenue: 5_000,
    maxRevenue: 30_000,
  })

  const startups = data?.startups ?? []
  if (startups.length === 0) return null

  return (
    <section className="w-full max-w-5xl mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
      <div className="text-center mb-8 sm:mb-10 landing-stagger-5">
        <h2
          className="font-(--font-geist) text-[1.5rem] sm:text-[1.875rem] lg:text-[2.125rem] leading-[1.15] tracking-[-0.035em] text-foreground mb-3"
          style={{ fontWeight: 750 }}
        >
          Real projects, real revenue
        </h2>
        <p
          className="font-(--font-geist) text-muted-foreground text-[13.5px] sm:text-[14.5px] max-w-[440px] mx-auto leading-[1.6]"
          style={{ fontWeight: 400, letterSpacing: '-0.01em' }}
        >
          Startups earning $5k–$30k/mo built with tools like Surgent
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 landing-stagger-6">
        {startups.map((s, i) => {
          const hasGrowth = s.growth30d != null && s.growth30d > 0
          return (
            <Link
              key={s.slug}
              href={`/inspirations/${s.slug}`}
              className={`group relative overflow-hidden flex flex-col rounded-2xl transition-all duration-300 border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] hover:border-black/[0.12] dark:hover:border-white/[0.12] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${BENTO[i] || 'col-span-1'}`}
            >
              {/* Screenshot */}
              <div className="w-full aspect-[16/10] overflow-hidden rounded-t-2xl bg-muted/20 relative">
                <ScreenshotImage website={s.website || ''} name={s.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Info */}
              <div className="p-3.5 sm:p-4 flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <img src={s.icon!} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-(--font-geist) text-[13.5px] sm:text-[14px] text-foreground truncate"
                      style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                    >
                      {s.name}
                    </h3>
                    {s.category && (
                      <span className="text-[10.5px] text-muted-foreground/60">{s.category}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <div>
                    <p
                      className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-0.5"
                      style={{ fontWeight: 600 }}
                    >
                      MRR
                    </p>
                    <span
                      className="font-(--font-geist) text-[16px] sm:text-[18px] text-foreground"
                      style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
                    >
                      {fmt(s.revenueMrr)}
                    </span>
                  </div>
                  {hasGrowth && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] text-emerald-500 mb-0.5"
                      style={{ fontWeight: 600 }}
                    >
                      <TrendingUp className="h-3 w-3" />+{s.growth30d!.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="flex justify-center mt-8">
        <Link
          href="/inspirations?rev=1k-30k"
          className="font-(--font-geist) inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontWeight: 500, letterSpacing: '-0.01em' }}
        >
          Explore all startups
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
