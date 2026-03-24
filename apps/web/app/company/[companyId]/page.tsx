'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  RocketLaunch,
  CreditCard,
  Eye,
  ChartLineUp,
  CaretRight,
  Sparkle,
  CaretDown,
  Check,
} from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function Card({
  title,
  icon: Icon,
  href,
  className,
  action,
  headerRight,
  children,
}: {
  title: string
  icon: React.ElementType
  href?: string
  className?: string
  action?: React.ReactNode
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl bg-foreground/[0.03] dark:bg-white/[0.04] min-h-[280px]',
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5 py-0.5">
          <div className="size-6 rounded-md bg-brand/10 flex items-center justify-center">
            <Icon className="size-3.5 text-brand" weight="fill" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {href && (
            <Link
              href={href}
              className="text-[13px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {action || 'View'}
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col px-3 pb-3">{children}</div>
    </div>
  )
}

function TaskRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/55 bg-white/80 dark:bg-white/[0.05] border border-foreground/[0.04] hover:border-foreground/[0.08] hover:text-foreground transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2.5">
        <span className="size-1.5 rounded-full bg-foreground/15" />
        <span>{label}</span>
      </div>
      <CaretRight className="size-4 shrink-0 text-foreground/20" />
    </button>
  )
}

const actionBtn =
  'inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium rounded-xl bg-white/80 dark:bg-white/[0.05] border border-foreground/[0.04] text-foreground/55 hover:border-foreground/[0.08] hover:text-foreground transition-colors cursor-pointer'

const PERIODS = ['Last 24h', 'Last 7 days', 'Last 30 days', 'Last 90 days'] as const

export default function DashboardPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const base = `/company/${companyId}`
  const [period, setPeriod] = useState<string>('Last 7 days')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <p className="text-xl font-semibold leading-tight text-foreground/80">
          <span className="block">Welcome back,</span>
          <span className="block">here&rsquo;s your overview</span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium text-foreground/55 bg-foreground/[0.03] dark:bg-white/[0.04] hover:bg-foreground/[0.06] transition-colors cursor-pointer focus-visible:outline-none shrink-0">
            {period}
            <CaretDown className="size-3 text-muted-foreground/30" weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="min-w-32 p-1">
            {PERIODS.map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'text-xs px-2 py-1.5 rounded-md cursor-pointer',
                  p === period ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card
          title="Website"
          icon={Eye}
          href={`${base}/editor`}
          action="Edit website"
          className="lg:col-span-2"
        >
          <Link
            href={`${base}/editor`}
            className="flex-1 rounded-xl bg-background dark:bg-white/[0.02] flex items-center justify-center overflow-hidden"
          >
            <span className="text-xs text-muted-foreground/40">Live preview</span>
          </Link>
          <div className="flex items-center gap-2 mt-2 px-2">
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-mono text-muted-foreground/60 truncate">
              myapp.surgent.site
            </span>
            <span className="text-[10px] font-medium text-muted-foreground/50 bg-foreground/[0.04] rounded-full px-2 py-px">
              Draft
            </span>
          </div>
        </Card>

        <Card title="Get started" icon={RocketLaunch}>
          <div className="flex flex-col gap-1.5">
            <TaskRow label="Edit your website" />
            <TaskRow label="Connect a domain" />
            <TaskRow label="Publish your site" />
            <TaskRow label="Set up payments" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card title="AI Agent" icon={Sparkle}>
          <div className="flex flex-col gap-0.5">
            {['Write a blog post', 'Create social content', 'Analyze competitors'].map((t) => (
              <Link
                key={t}
                href={`${base}/editor`}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
              >
                <Sparkle className="size-4 shrink-0 text-foreground/20" />
                <span className="truncate">{t}</span>
              </Link>
            ))}
          </div>
          <div className="mt-auto pt-3">
            <Link href={`${base}/editor`} className={actionBtn}>
              Start a chat
            </Link>
          </div>
        </Card>

        <Card title="Payments" icon={CreditCard} action="Set up" href={`${base}/settings`}>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="text-center relative z-10">
              <p className="text-3xl font-semibold tabular-nums">$0.00</p>
              <p className="text-xs text-muted-foreground mt-1">0 transactions</p>
            </div>
            {/* Decorative sparkline */}
            <svg
              className="absolute bottom-0 left-0 w-full h-16 opacity-100"
              viewBox="0 0 200 40"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className="[stop-color:var(--color-brand)]" stopOpacity="0.1" />
                  <stop offset="100%" className="[stop-color:var(--color-brand)]" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 35 Q25 32 50 28 T100 20 T150 25 T200 15 V40 H0Z"
                fill="url(#spark-fill)"
              />
              <path
                d="M0 35 Q25 32 50 28 T100 20 T150 25 T200 15"
                fill="none"
                className="stroke-brand/30"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </Card>

        <Card title="Analytics" icon={ChartLineUp} href={`${base}/analytics`}>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="grid grid-cols-2 gap-8 text-center relative z-10">
              <div>
                <p className="text-3xl font-semibold tabular-nums">0</p>
                <p className="text-xs text-muted-foreground mt-1">Visitors</p>
              </div>
              <div>
                <p className="text-3xl font-semibold tabular-nums">0</p>
                <p className="text-xs text-muted-foreground mt-1">Page views</p>
              </div>
            </div>
            {/* Decorative sparkline */}
            <svg
              className="absolute bottom-0 left-0 w-full h-16 opacity-100"
              viewBox="0 0 200 40"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="spark-fill-2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className="[stop-color:var(--color-brand)]" stopOpacity="0.1" />
                  <stop offset="100%" className="[stop-color:var(--color-brand)]" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 30 Q30 28 60 22 T120 18 T160 22 T200 12 V40 H0Z"
                fill="url(#spark-fill-2)"
              />
              <path
                d="M0 30 Q30 28 60 22 T120 18 T160 22 T200 12"
                fill="none"
                className="stroke-brand/30"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </Card>
      </div>
    </div>
  )
}
