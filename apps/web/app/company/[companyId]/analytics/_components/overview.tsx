'use client'

import { useState, useMemo } from 'react'
import {
  Users,
  Eye,
  Clock,
  ArrowsLeftRight,
  Globe,
  Desktop,
  ShareNetwork,
  ChartLineUp,
  CalendarBlank,
} from '@phosphor-icons/react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
// @ts-expect-error -- no types for react-simple-maps
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  useWebsiteStats,
  useWebsitePageviews,
  useWebsiteMetrics,
  type MetricType,
} from '@/queries/analytics'
import { getTimezone, parseDateRange } from '@/lib/analytics-date'
import { getSeriesDayHour, mergeTimeSeries } from '@/lib/analytics-series'
import {
  Panel,
  MetricCard,
  MetricsTable,
  BarRow,
  fmt,
  pctChange,
  formatDuration,
  bounceRate,
  bounceRateNum,
  activeTabClass,
  inactiveTabClass,
} from './shared'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const UNITS = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'month', label: 'Monthly' },
] as const

// ── Metrics bar ─────────────────────────────────────────────────

export function MetricsBar({
  projectId,
  rangeValue,
  compare,
  filters,
}: {
  projectId: string
  rangeValue: string
  compare?: 'prev' | 'yoy'
  filters?: Record<string, string>
}) {
  const { data: stats } = useWebsiteStats(projectId, rangeValue, compare, filters)
  const c = stats?.comparison
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <MetricCard
        icon={Users}
        label="Visitors"
        value={fmt(stats?.visitors ?? 0)}
        change={c ? pctChange(stats!.visitors, c.visitors) : undefined}
      />
      <MetricCard
        icon={ArrowsLeftRight}
        label="Visits"
        value={fmt(stats?.visits ?? 0)}
        change={c ? pctChange(stats!.visits, c.visits) : undefined}
      />
      <MetricCard
        icon={Eye}
        label="Views"
        value={fmt(stats?.pageviews ?? 0)}
        change={c ? pctChange(stats!.pageviews, c.pageviews) : undefined}
      />
      <MetricCard
        icon={ArrowsLeftRight}
        label="Bounce Rate"
        value={bounceRate(stats?.bounces ?? 0, stats?.visits ?? 0)}
        reverseColors
        change={
          c
            ? pctChange(
                bounceRateNum(stats!.bounces, stats!.visits),
                bounceRateNum(c.bounces, c.visits),
              )
            : undefined
        }
      />
      <MetricCard
        icon={Clock}
        label="Visit Duration"
        value={formatDuration(stats?.totaltime ?? 0, stats?.visits ?? 0)}
      />
    </div>
  )
}

// ── Chart tooltip ───────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: p.name === 'pageviews' ? 'var(--color-brand)' : '#94a3b8' }}
          />
          <span className="text-muted-foreground/60">
            {p.name === 'pageviews' ? 'Views' : 'Visitors'}
          </span>
          <span className="ml-auto font-mono font-medium tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Pageviews chart ─────────────────────────────────────────────

export function PageviewsChart({
  projectId,
  rangeValue,
  unit,
  compare,
  filters,
}: {
  projectId: string
  rangeValue: string
  unit: string
  compare?: 'prev' | 'yoy'
  filters?: Record<string, string>
}) {
  const { data: pageviews } = useWebsitePageviews(projectId, rangeValue, unit, compare, filters)

  if (!pageviews?.pageviews?.length) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-2">
        <div className="size-10 rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04] flex items-center justify-center">
          <ChartLineUp className="size-5 text-muted-foreground/20" />
        </div>
        <p className="text-[12px] text-muted-foreground/30">No traffic data yet</p>
      </div>
    )
  }

  const data = mergeTimeSeries(pageviews.pageviews, pageviews.sessions ?? [], unit).map(
    (point) => ({
      label: point.label,
      pageviews: point.left,
      visitors: point.right,
    }),
  )

  return (
    <>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmt}
            />
            <RechartsTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="pageviews"
              stroke="var(--color-brand)"
              strokeWidth={1.5}
              fill="url(#fillViews)"
            />
            <Area
              type="monotone"
              dataKey="visitors"
              stroke="#94a3b8"
              strokeWidth={1.5}
              fill="url(#fillVisitors)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <span className="size-2 rounded-full bg-brand" /> Page Views
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <span className="size-2 rounded-full bg-slate-400" /> Visitors
        </div>
      </div>
    </>
  )
}

// ── Unit filter ─────────────────────────────────────────────────

export function UnitFilter({
  unit,
  onChange,
  rangeValue,
}: {
  unit: string
  onChange: (u: string) => void
  rangeValue: string
}) {
  const minUnit = parseDateRange(rangeValue).unit
  const available = UNITS.filter((u) => {
    if (minUnit === 'hour') return true
    if (minUnit === 'day') return u.value !== 'hour'
    if (minUnit === 'month') return u.value === 'month'
    return true
  })
  return (
    <div className="flex items-center gap-0.5 text-[11px]">
      {available.map((u) => (
        <button
          key={u.value}
          onClick={() => onChange(u.value)}
          className={cn(
            'rounded-md px-2 py-0.5 font-medium transition-colors cursor-pointer',
            u.value === unit ? activeTabClass : inactiveTabClass,
          )}
        >
          {u.label}
        </button>
      ))}
    </div>
  )
}

// ── Tabbed panel ────────────────────────────────────────────────

export function MetricsPanel({
  title,
  icon: Icon,
  tabs,
  projectId,
  rangeValue,
  onExpand,
  filters,
  onFilter,
}: {
  title: string
  icon: React.ElementType
  tabs: { label: string; type: MetricType }[]
  projectId: string
  rangeValue: string
  onExpand: (type: MetricType) => void
  filters?: Record<string, string>
  onFilter?: (type: string, value: string) => void
}) {
  const [active, setActive] = useState(tabs[0]!.type)
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-muted-foreground/30" weight="duotone" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.type}
              onClick={() => setActive(t.type)}
              className={cn(
                'px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                active === t.type ? activeTabClass : inactiveTabClass,
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <PanelContent
        projectId={projectId}
        type={active}
        rangeValue={rangeValue}
        onViewMore={() => onExpand(active)}
        filters={filters}
        onFilter={onFilter}
      />
    </Panel>
  )
}

function PanelContent({
  projectId,
  type,
  rangeValue,
  onViewMore,
  filters,
  onFilter,
}: {
  projectId: string
  type: MetricType
  rangeValue: string
  onViewMore: () => void
  filters?: Record<string, string>
  onFilter?: (type: string, value: string) => void
}) {
  const { data } = useWebsiteMetrics(projectId, type, rangeValue, 10, undefined, filters)
  return (
    <MetricsTable
      items={data ?? []}
      onViewMore={onViewMore}
      type={type}
      onFilter={onFilter}
      filters={filters}
    />
  )
}

// ── World map ───────────────────────────────────────────────────

export function WorldMap({
  projectId,
  rangeValue,
  filters,
}: {
  projectId: string
  rangeValue: string
  filters?: Record<string, string>
}) {
  const { data: countries } = useWebsiteMetrics(
    projectId,
    'country',
    rangeValue,
    200,
    undefined,
    filters,
  )
  const countryMap = useMemo(() => {
    const m = new Map<string, number>()
    countries?.forEach((c) => m.set(c.x, c.y))
    return m
  }, [countries])
  const maxVal = useMemo(() => Math.max(...(countries?.map((c) => c.y) ?? []), 1), [countries])

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-2">
        <Globe className="size-3.5 text-muted-foreground/30" weight="duotone" />
        <p className="text-sm font-medium">World Map</p>
      </div>
      <div className="h-[260px]">
        <ComposableMap
          projectionConfig={{ rotate: [-10, 0, 0], scale: 140 }}
          className="w-full h-full"
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({
                geographies,
              }: {
                geographies: Array<{
                  rsmKey: string
                  id: string
                  properties?: Record<string, string>
                }>
              }) =>
                geographies.map((geo) => {
                  const count = countryMap.get(geo.properties?.ISO_A2 || geo.id) ?? 0
                  const opacity = count ? Math.max(0.15, (count / maxVal) * 0.85) : 0
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={count ? `rgba(124, 92, 252, ${opacity})` : 'var(--color-muted)'}
                      stroke="var(--color-border)"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          outline: 'none',
                          fill: count ? 'var(--color-brand)' : 'var(--color-muted)',
                        },
                        pressed: { outline: 'none' },
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </Panel>
  )
}

// ── Weekly traffic ───────────────────────────────────────────────

export function WeeklyTraffic({
  projectId,
  rangeValue,
  filters,
}: {
  projectId: string
  rangeValue: string
  filters?: Record<string, string>
}) {
  const { data: pageviews } = useWebsitePageviews(projectId, rangeValue, 'hour', undefined, filters)
  const timezone = getTimezone()

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    if (!pageviews?.pageviews) return grid
    pageviews.pageviews.forEach((pv) => {
      const { day, hour } = getSeriesDayHour(pv.x, timezone)
      const di = DAYS.indexOf(day ?? '')
      if (di < 0) return
      const row = grid[di]
      if (!row) return
      row[hour] = (row[hour] ?? 0) + pv.y
    })
    return grid
  }, [pageviews, timezone])

  const maxVal = useMemo(() => Math.max(...heatmap.flat(), 1), [heatmap])

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-3">
        <CalendarBlank className="size-3.5 text-muted-foreground/30" weight="duotone" />
        <p className="text-sm font-medium">Weekly Traffic</p>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-px text-[9px] min-w-[500px]">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-muted-foreground/30 pb-1">
              {h}
            </div>
          ))}
          {DAYS.map((day, di) => (
            <div key={di} className="contents">
              <div className="text-muted-foreground/40 pr-2 flex items-center justify-end">
                {day}
              </div>
              {(heatmap[di] ?? []).map((val, hi) => (
                <div
                  key={hi}
                  className="aspect-square rounded-sm"
                  title={`${day} ${hi}:00 — ${val} views`}
                  style={{
                    backgroundColor: val
                      ? `rgba(124, 92, 252, ${Math.max(0.1, (val / maxVal) * 0.8)})`
                      : 'var(--color-foreground)',
                    opacity: val ? 1 : 0.03,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── Expanded view ───────────────────────────────────────────────

const EXPANDED_TITLES: Record<string, string> = {
  path: 'Pages',
  entry: 'Entry Pages',
  exit: 'Exit Pages',
  referrer: 'Referrers',
  channel: 'Channels',
  browser: 'Browsers',
  os: 'Operating Systems',
  device: 'Devices',
  country: 'Countries',
  region: 'Regions',
  city: 'Cities',
}

export function ExpandedView({
  projectId,
  type,
  rangeValue,
  open,
  onClose,
  filters,
  onFilter,
}: {
  projectId: string
  type: MetricType | null
  rangeValue: string
  open: boolean
  onClose: () => void
  filters?: Record<string, string>
  onFilter?: (type: string, value: string) => void
}) {
  const { data } = useWebsiteMetrics(projectId, type || 'path', rangeValue, 100, undefined, filters)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{EXPANDED_TITLES[type || 'path'] ?? type}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-6 px-6">
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider">
            <span>Name</span>
            <span>Visitors</span>
          </div>
          <MetricsTable
            items={data ?? []}
            type={type || 'path'}
            onFilter={onFilter}
            filters={filters}
            size="md"
            emptyText="No data for this period"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
