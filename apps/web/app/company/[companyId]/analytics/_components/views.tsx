'use client'

import { useState, useMemo } from 'react'
import { Lightning, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  useWebsiteActive,
  useWebsiteRealtime,
  useWebsiteSessions,
  useWebsiteMetrics,
  type MetricItem,
} from '@/queries/analytics'
import { Panel, MetricsTable, BarRow, fmt, timeAgo } from './shared'

// ── Real-time view ──────────────────────────────────────────────

function sortedEntries(obj?: Record<string, number>, limit = 10): MetricItem[] {
  if (!obj) return []
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([x, y]) => ({ x, y }))
}

export function RealtimeView({ projectId }: { projectId: string }) {
  const { data: active } = useWebsiteActive(projectId)
  const { data: rt } = useWebsiteRealtime(projectId)

  const topUrls = useMemo(() => sortedEntries(rt?.urls), [rt])
  const topCountries = useMemo(() => sortedEntries(rt?.countries), [rt])
  const topReferrers = useMemo(() => sortedEntries(rt?.referrers), [rt])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { value: active?.visitors ?? 0, label: 'Active Now', highlight: true },
          { value: rt?.totals?.views ?? 0, label: 'Views (30m)' },
          { value: rt?.totals?.visitors ?? 0, label: 'Visitors (30m)' },
          { value: rt?.totals?.countries ?? 0, label: 'Countries' },
        ].map((m) => (
          <Panel key={m.label} className="text-center">
            <p className={cn('text-3xl font-semibold tabular-nums', m.highlight && 'text-brand')}>
              {fmt(m.value)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">{m.label}</p>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[
          { title: 'Active Pages', items: topUrls },
          { title: 'Referrers', items: topReferrers },
          { title: 'Countries', items: topCountries },
        ].map((s) => (
          <Panel key={s.title}>
            <p className="text-sm font-medium mb-3">{s.title}</p>
            <MetricsTable items={s.items} />
          </Panel>
        ))}
      </div>

      {rt?.events && rt.events.length > 0 && (
        <Panel>
          <p className="text-sm font-medium mb-3">Live Activity</p>
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {rt.events.slice(0, 50).map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5 text-[12px]">
                <span
                  className={cn(
                    'size-1.5 rounded-full shrink-0',
                    ev.__type === 'event' ? 'bg-amber-500' : 'bg-brand',
                  )}
                />
                <span className="text-foreground/60 truncate flex-1">{ev.urlPath}</span>
                {ev.country && (
                  <span className="text-muted-foreground/40 shrink-0">{ev.country}</span>
                )}
                {ev.eventName && (
                  <span className="text-amber-600 dark:text-amber-400 text-[11px] shrink-0">
                    {ev.eventName}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ── Sessions view ───────────────────────────────────────────────

const SESSION_COLS = 'grid-cols-[1fr_80px_80px_60px_60px_80px]'

export function SessionsView({ projectId, rangeValue }: { projectId: string; rangeValue: string }) {
  const [page, setPage] = useState(1)
  const { data } = useWebsiteSessions(projectId, rangeValue, page, 20)
  const sessions = data?.data ?? []
  const totalPages = data ? Math.ceil(data.count / 20) : 0

  return (
    <div className="space-y-3">
      <Panel className="overflow-hidden !p-0">
        <div
          className={cn(
            'grid gap-2 px-4 py-2.5 text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider border-b border-foreground/[0.04]',
            SESSION_COLS,
          )}
        >
          <span>Visitor</span>
          <span>Browser</span>
          <span>OS</span>
          <span>Views</span>
          <span>Visits</span>
          <span>Last seen</span>
        </div>
        {sessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground/30">
            No sessions found
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                'grid gap-2 px-4 py-2.5 text-[12px] border-b border-foreground/[0.02] last:border-0 hover:bg-foreground/[0.01] transition-colors',
                SESSION_COLS,
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-foreground/60">{s.country || '—'}</span>
                {s.city && <span className="text-muted-foreground/40">{s.city}</span>}
              </div>
              <span className="text-foreground/50 truncate">{s.browser || '—'}</span>
              <span className="text-foreground/50 truncate">{s.os || '—'}</span>
              <span className="font-mono tabular-nums text-foreground/60">{s.views}</span>
              <span className="font-mono tabular-nums text-foreground/60">{s.visits}</span>
              <span className="text-muted-foreground/40">{timeAgo(s.lastAt)}</span>
            </div>
          ))
        )}
      </Panel>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          >
            <CaretLeft className="size-4" />
          </button>
          <span className="text-[12px] text-muted-foreground/50 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          >
            <CaretRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Events view ─────────────────────────────────────────────────

export function EventsView({ projectId, rangeValue }: { projectId: string; rangeValue: string }) {
  const { data: events } = useWebsiteMetrics(projectId, 'event', rangeValue, 50)
  const max = events?.[0]?.y ?? 1

  return (
    <Panel>
      <p className="text-sm font-medium mb-3">Custom Events</p>
      {!events?.length ? (
        <div className="py-12 text-center text-xs text-muted-foreground/30">
          No events tracked yet
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider">
            <span>Event</span>
            <span>Count</span>
          </div>
          {events.map((item, i) => (
            <div key={`${item.x}-${i}`} className="relative">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-brand/[0.05] dark:bg-brand/[0.08]"
                style={{ width: `${(item.y / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <Lightning className="size-3 text-amber-500" weight="fill" />
                  <span className="text-[13px] text-foreground/70">{item.x}</span>
                </div>
                <span className="text-[13px] font-mono tabular-nums text-muted-foreground/60">
                  {fmt(item.y)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
