'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ChartLineUp,
  WaveSquare,
  UserList,
  Lightning,
  CaretDown,
  CaretLeft,
  CaretRight,
  ArrowCounterClockwise,
  Eye,
  Globe,
  Desktop,
  ShareNetwork,
} from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { DATE_RANGE_PRESETS, type DateRangeValue, type MetricType } from '@/queries/analytics'
import { parseDateRange, getOffsetDateRange, canGoForward } from '@/lib/analytics-date'
import {
  ActiveBadge,
  FilterBar,
  Panel,
  activeTabClass,
  inactiveTabClass,
} from './_components/shared'
import {
  MetricsBar,
  PageviewsChart,
  UnitFilter,
  MetricsPanel,
  WorldMap,
  WeeklyTraffic,
  ExpandedView,
} from './_components/overview'
import { RealtimeView, SessionsView, EventsView } from './_components/views'

// ── View navigation ─────────────────────────────────────────────

const VIEWS = [
  { key: 'overview', label: 'Overview', icon: ChartLineUp },
  { key: 'realtime', label: 'Real-time', icon: WaveSquare },
  { key: 'sessions', label: 'Sessions', icon: UserList },
  { key: 'events', label: 'Events', icon: Lightning },
] as const

type View = (typeof VIEWS)[number]['key']

// ── Page ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { companyId: projectId } = useParams<{ companyId: string }>()
  const [rangeValue, setRangeValue] = useState<DateRangeValue>('7day')
  const [unit, setUnit] = useState(() => parseDateRange('7day').unit)
  const [offset, setOffset] = useState(0)
  const [expandedType, setExpandedType] = useState<MetricType | null>(null)
  const [view, setView] = useState<View>('overview')
  const [compare, setCompare] = useState<'prev' | 'yoy' | undefined>(undefined)
  const [filters, setFilters] = useState<Record<string, string>>({})

  function handleFilter(type: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev }
      if (next[type] === value) {
        delete next[type]
      } else {
        next[type] = value
      }
      return next
    })
  }

  const baseRange = parseDateRange(rangeValue)
  const effectiveRange = (() => {
    let r = baseRange
    for (let i = 0; i < Math.abs(offset); i++) r = getOffsetDateRange(r, offset > 0 ? 1 : -1)
    return r
  })()
  const forward = canGoForward(effectiveRange)

  function handleRangeChange(value: DateRangeValue) {
    setRangeValue(value)
    setUnit(parseDateRange(value).unit)
    setOffset(0)
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold">Analytics</h2>
            <p className="text-xs text-muted-foreground/50">Traffic and visitor insights</p>
          </div>
          <ActiveBadge projectId={projectId} />
        </div>

        <div className="flex items-center gap-2">
          {/* Compare toggle (overview only) */}
          {view === 'overview' && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer focus-visible:outline-none shrink-0',
                  compare
                    ? 'text-brand bg-brand/[0.08]'
                    : 'text-muted-foreground/40 bg-foreground/[0.03] dark:bg-white/[0.04] hover:bg-foreground/[0.06]',
                )}
              >
                <ArrowCounterClockwise className="size-3" weight="bold" />
                {compare === 'prev' ? 'vs prev' : compare === 'yoy' ? 'vs YoY' : 'Compare'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-32 p-1">
                {([undefined, 'prev', 'yoy'] as const).map((v) => (
                  <DropdownMenuItem
                    key={v ?? 'off'}
                    onClick={() => setCompare(v)}
                    className={cn(
                      'text-xs px-2 py-1.5 rounded-md cursor-pointer',
                      compare === v ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {v === 'prev' ? 'Previous period' : v === 'yoy' ? 'Year over year' : 'Off'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Date range with prev/next */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="size-8 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-foreground bg-foreground/[0.03] dark:bg-white/[0.04] hover:bg-foreground/[0.06] transition-colors cursor-pointer"
            >
              <CaretLeft className="size-3.5" weight="bold" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium text-foreground/55 bg-foreground/[0.03] dark:bg-white/[0.04] hover:bg-foreground/[0.06] transition-colors cursor-pointer focus-visible:outline-none shrink-0">
                {offset === 0
                  ? DATE_RANGE_PRESETS.find((r) => r.value === rangeValue)?.label
                  : `${effectiveRange.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${effectiveRange.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                <CaretDown className="size-3 text-muted-foreground/30" weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-36 p-1">
                {DATE_RANGE_PRESETS.map((r) => (
                  <DropdownMenuItem
                    key={r.value}
                    onClick={() => handleRangeChange(r.value)}
                    className={cn(
                      'text-xs px-2 py-1.5 rounded-md cursor-pointer',
                      r.value === rangeValue ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {r.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => setOffset((o) => o + 1)}
              disabled={!forward}
              className="size-8 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-foreground bg-foreground/[0.03] dark:bg-white/[0.04] hover:bg-foreground/[0.06] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <CaretRight className="size-3.5" weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer',
              v.key === view ? activeTabClass : inactiveTabClass,
            )}
          >
            <v.icon className="size-3.5" weight={v.key === view ? 'fill' : 'regular'} />
            {v.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <>
          {Object.keys(filters).length > 0 && (
            <FilterBar
              filters={filters}
              onRemove={(key) =>
                setFilters((prev) => {
                  const next = { ...prev }
                  delete next[key]
                  return next
                })
              }
              onClear={() => setFilters({})}
            />
          )}

          <MetricsBar
            projectId={projectId}
            rangeValue={rangeValue}
            compare={compare || 'prev'}
            filters={filters}
          />

          <Panel>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Pageviews & Visitors</p>
              <UnitFilter unit={unit} onChange={setUnit} rangeValue={rangeValue} />
            </div>
            <PageviewsChart
              projectId={projectId}
              rangeValue={rangeValue}
              unit={unit}
              compare={compare}
              filters={filters}
            />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MetricsPanel
              title="Pages"
              icon={Eye}
              tabs={[
                { label: 'Pages', type: 'path' },
                { label: 'Entry', type: 'entry' },
                { label: 'Exit', type: 'exit' },
              ]}
              projectId={projectId}
              rangeValue={rangeValue}
              onExpand={setExpandedType}
              filters={filters}
              onFilter={handleFilter}
            />
            <MetricsPanel
              title="Sources"
              icon={ShareNetwork}
              tabs={[
                { label: 'Referrers', type: 'referrer' },
                { label: 'Channels', type: 'channel' },
              ]}
              projectId={projectId}
              rangeValue={rangeValue}
              onExpand={setExpandedType}
              filters={filters}
              onFilter={handleFilter}
            />
            <MetricsPanel
              title="Environment"
              icon={Desktop}
              tabs={[
                { label: 'Browser', type: 'browser' },
                { label: 'OS', type: 'os' },
                { label: 'Device', type: 'device' },
              ]}
              projectId={projectId}
              rangeValue={rangeValue}
              onExpand={setExpandedType}
              filters={filters}
              onFilter={handleFilter}
            />
            <MetricsPanel
              title="Location"
              icon={Globe}
              tabs={[
                { label: 'Countries', type: 'country' },
                { label: 'Regions', type: 'region' },
                { label: 'Cities', type: 'city' },
              ]}
              projectId={projectId}
              rangeValue={rangeValue}
              onExpand={setExpandedType}
              filters={filters}
              onFilter={handleFilter}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <WorldMap projectId={projectId} rangeValue={rangeValue} filters={filters} />
            <WeeklyTraffic projectId={projectId} rangeValue={rangeValue} filters={filters} />
          </div>

          <ExpandedView
            projectId={projectId}
            type={expandedType}
            rangeValue={rangeValue}
            open={expandedType !== null}
            onClose={() => setExpandedType(null)}
            filters={filters}
            onFilter={handleFilter}
          />
        </>
      )}

      {view === 'realtime' && <RealtimeView projectId={projectId} />}
      {view === 'sessions' && <SessionsView projectId={projectId} rangeValue={rangeValue} />}
      {view === 'events' && <EventsView projectId={projectId} rangeValue={rangeValue} />}
    </div>
  )
}
