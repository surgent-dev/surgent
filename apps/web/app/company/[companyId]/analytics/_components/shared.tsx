'use client'

import { ArrowUp, ArrowDown, Pulse } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useWebsiteActive, type MetricItem } from '@/queries/analytics'

// ── Formatting helpers ──────────────────────────────────────────

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function pctChange(
  current: number,
  previous: number,
): { value: string; up: boolean } | null {
  if (!previous) return current > 0 ? { value: '+100%', up: true } : null
  const diff = ((current - previous) / previous) * 100
  if (Math.abs(diff) < 0.5) return null
  return { value: `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`, up: diff > 0 }
}

export function formatDuration(totaltime: number, visits: number): string {
  if (!visits) return '0s'
  const secs = Math.round(totaltime / visits / 1000)
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
  if (secs >= 60) {
    const m = Math.floor(secs / 60),
      s = secs % 60
    return s ? `${m}m ${s}s` : `${m}m`
  }
  return `${secs}s`
}

export function bounceRate(bounces: number, visits: number): string {
  if (!visits) return '0%'
  return `${Math.round((bounces / visits) * 100)}%`
}

export function bounceRateNum(bounces: number, visits: number): number {
  return visits ? (bounces / visits) * 100 : 0
}

export function timeAgo(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

// ── Shared style constants ──────────────────────────────────────

export const panelClass = 'rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04]'
export const activeTabClass = 'text-brand bg-brand/[0.08]'
export const inactiveTabClass = 'text-muted-foreground/40 hover:text-muted-foreground/70'

// ── Panel wrapper ───────────────────────────────────────────────

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(panelClass, 'p-4', className)}>{children}</div>
}

// ── Change badge ────────────────────────────────────────────────

export function ChangeBadge({
  change,
  reverse,
}: {
  change: { value: string; up: boolean } | null | undefined
  reverse?: boolean
}) {
  if (!change) return null
  const isPositive = reverse ? !change.up : change.up
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[11px] font-medium',
        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
      )}
    >
      {change.up ? (
        <ArrowUp className="size-3" weight="bold" />
      ) : (
        <ArrowDown className="size-3" weight="bold" />
      )}
      {change.value}
    </span>
  )
}

// ── Metric card ─────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  reverseColors,
}: {
  label: string
  value: string
  change?: { value: string; up: boolean } | null
  icon: React.ElementType
  reverseColors?: boolean
}) {
  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground/60 font-medium">{label}</span>
        <Icon className="size-4 text-muted-foreground/25" weight="duotone" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        <ChangeBadge change={change} reverse={reverseColors} />
      </div>
    </Panel>
  )
}

// ── Country code → flag emoji ────────────────────────────────────

export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

// ── Bar row (reusable in tables + expanded view) ────────────────

export function BarRow({
  label,
  value,
  pct,
  size = 'sm',
  prefix,
}: {
  label: string
  value: number
  pct: number
  size?: 'sm' | 'md'
  prefix?: React.ReactNode
}) {
  const py = size === 'md' ? 'py-2' : 'py-1.5'
  const text = size === 'md' ? 'text-[13px]' : 'text-[12px]'
  return (
    <div className="relative">
      <div
        className="absolute inset-y-0 left-0 rounded-md bg-brand/[0.05] dark:bg-brand/[0.08] transition-all"
        style={{ width: `${pct}%` }}
      />
      <div className={cn('relative flex items-center justify-between px-2.5', py)}>
        <span
          className={cn(text, 'text-foreground/70 truncate max-w-[70%] flex items-center gap-1.5')}
        >
          {prefix}
          {label || '(none)'}
        </span>
        <span className={cn(text, 'font-mono tabular-nums text-muted-foreground/60')}>
          {fmt(value)}
        </span>
      </div>
    </div>
  )
}

// ── Metrics table ───────────────────────────────────────────────

export function MetricsTable({
  items,
  onViewMore,
  type,
}: {
  items: MetricItem[]
  onViewMore?: () => void
  type?: string
}) {
  const max = Math.max(...items.map((i) => i.y), 1)
  const showFlag = type === 'country' || type === 'region' || type === 'city'
  return (
    <>
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground/30">No data yet</div>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <BarRow
              key={`${item.x}-${i}`}
              label={item.x}
              value={item.y}
              pct={(item.y / max) * 100}
              prefix={
                showFlag ? (
                  <span className="text-sm leading-none">{countryFlag(item.x)}</span>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
      {onViewMore && items.length >= 10 && (
        <button
          onClick={onViewMore}
          className="mt-2 text-[11px] font-medium text-brand/70 hover:text-brand transition-colors cursor-pointer"
        >
          View more
        </button>
      )}
    </>
  )
}

// ── Active badge ────────────────────────────────────────────────

export function ActiveBadge({ projectId }: { projectId: string }) {
  const { data: active } = useWebsiteActive(projectId)
  const count = active?.visitors ?? 0
  if (!count) return null
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
      <span className="relative size-1.5">
        <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping" />
        <span className="relative block size-1.5 rounded-full bg-emerald-500" />
      </span>
      {count} online
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className={cn(panelClass, 'size-12 flex items-center justify-center')}>
        <Pulse className="size-6 text-muted-foreground/20" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/40">No analytics data yet</p>
        <p className="text-xs text-muted-foreground/25 mt-0.5">
          Data will appear once your site receives traffic
        </p>
      </div>
    </div>
  )
}
