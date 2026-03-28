'use client'

import { ChartLineUp } from '@phosphor-icons/react'
import { Sparkline } from '@/components/ui/sparkline'
import { parseDateRange } from '@/lib/analytics-date'
import { getSparklineSeries } from '@/lib/analytics-series'
import { DashboardCard } from './dashboard-card'
import {
  useWebsiteActive,
  useWebsitePageviews,
  useWebsiteStats,
  type DateRangeValue,
} from '@/queries/analytics'

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getSparklineSize(rangeValue: DateRangeValue) {
  if (rangeValue === '24hour') return 24
  if (rangeValue === '7day') return 8
  if (rangeValue === '30day') return 15
  if (rangeValue === '90day') return 18
  return 12
}

export function AnalyticsCard({
  projectId,
  href,
  rangeValue,
}: {
  projectId: string
  href: string
  rangeValue: DateRangeValue
}) {
  const unit = parseDateRange(rangeValue).unit
  const { data: stats } = useWebsiteStats(projectId, rangeValue, 'prev')
  const { data: pageviews } = useWebsitePageviews(projectId, rangeValue, unit)
  const { data: active } = useWebsiteActive(projectId)

  const visitors = stats?.visitors ?? 0
  const views = stats?.pageviews ?? 0
  const activeCount = active?.visitors ?? 0
  const sparkData = getSparklineSeries(pageviews?.pageviews ?? [], getSparklineSize(rangeValue))

  return (
    <DashboardCard
      title="Analytics"
      icon={ChartLineUp}
      href={href}
      headerRight={
        activeCount > 0 ? (
          <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative size-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping" />
              <span className="relative block size-1.5 rounded-full bg-emerald-500" />
            </span>
            {activeCount} live
          </div>
        ) : undefined
      }
    >
      <div className="flex-1 grid grid-rows-1 grid-cols-1 min-h-[140px]">
        <div className="row-start-1 col-start-1 self-end h-20 pointer-events-none">
          <Sparkline key={rangeValue} data={sparkData} />
        </div>
        <div className="row-start-1 col-start-1 flex items-center justify-center z-10">
          <div className="grid grid-cols-2 gap-8 text-center">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{fmtNum(visitors)}</p>
              <p className="text-xs text-muted-foreground mt-1">Visitors</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">{fmtNum(views)}</p>
              <p className="text-xs text-muted-foreground mt-1">Page views</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
