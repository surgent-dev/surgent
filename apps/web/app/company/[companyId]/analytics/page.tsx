'use client'

import { Users, Eye, Globe, DeviceMobile, ArrowUp } from '@phosphor-icons/react'

function Metric({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string
  value: string
  change?: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className="size-4 text-muted-foreground/40" weight="duotone" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {change && (
          <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <ArrowUp className="size-3" weight="bold" />
            {change}
          </span>
        )}
      </div>
    </div>
  )
}

function ChartPlaceholder({ title, h }: { title: string; h: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04] p-4">
      <p className="text-sm font-medium mb-3">{title}</p>
      <div
        className={`rounded-lg bg-white/80 dark:bg-white/[0.03] border border-foreground/[0.04] flex items-center justify-center ${h}`}
      >
        <span className="text-xs text-muted-foreground/30">Chart</span>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Analytics</h2>
          <p className="text-xs text-muted-foreground/50">Traffic and visitor insights</p>
        </div>
        <div className="flex items-center rounded-xl bg-white/80 dark:bg-white/[0.05] border border-foreground/[0.04] p-0.5 text-xs">
          {['24h', '7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                p === '7d'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={Users} label="Visitors" value="0" />
        <Metric icon={Eye} label="Page Views" value="0" />
        <Metric icon={Globe} label="Countries" value="0" />
        <Metric icon={DeviceMobile} label="Mobile" value="0%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartPlaceholder title="Visitors Over Time" h="h-48" />
        <ChartPlaceholder title="Top Pages" h="h-48" />
        <ChartPlaceholder title="Traffic Sources" h="h-48" />
        <ChartPlaceholder title="Locations" h="h-48" />
      </div>
    </div>
  )
}
