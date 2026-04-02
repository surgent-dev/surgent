/**
 * Analytics query hooks — mirrors Umami API contract 1:1.
 *
 * All endpoints go through the worker proxy:
 *   GET /api/projects/:id/analytics/<path>?startAt&endAt&unit&timezone&compare&type&limit
 */
import { useQuery } from '@tanstack/react-query'
import { type DateRange, getTimezone, parseDateRange } from '@/lib/analytics-date'
import { http } from '@/lib/http'

// ── Types (match Umami response shapes exactly) ─────────────────

export interface WebsiteStats {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  totaltime: number
}

export interface WebsiteStatsResponse extends WebsiteStats {
  comparison?: WebsiteStats
}

export interface TimeSeriesPoint {
  x: string
  y: number
}

export interface PageviewsResponse {
  pageviews: TimeSeriesPoint[]
  sessions: TimeSeriesPoint[]
  compare?: {
    pageviews: TimeSeriesPoint[]
    sessions: TimeSeriesPoint[]
  }
}

export interface MetricItem {
  x: string
  y: number
  z?: number // percent
}

// ── Range presets (same values Umami uses) ───────────────────────

export const DATE_RANGE_PRESETS = [
  { value: '1hour', label: 'Last hour' },
  { value: '24hour', label: 'Last 24 hours' },
  { value: '7day', label: 'Last 7 days' },
  { value: '30day', label: 'Last 30 days' },
  { value: '90day', label: 'Last 90 days' },
  { value: '1year', label: 'Last year' },
] as const

export type DateRangeValue = (typeof DATE_RANGE_PRESETS)[number]['value']

// ── Metric types Umami supports ─────────────────────────────────

export const METRIC_TYPES = {
  // Page metrics
  path: 'path',
  entry: 'entry',
  exit: 'exit',
  // Source metrics
  referrer: 'referrer',
  channel: 'channel',
  // Environment metrics
  browser: 'browser',
  os: 'os',
  device: 'device',
  // Location metrics
  country: 'country',
  region: 'region',
  city: 'city',
  // Other
  language: 'language',
  event: 'event',
  title: 'title',
  query: 'query',
} as const

export type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES]

// ── Helpers ──────────────────────────────────────────────────────

function buildUrl(projectId: string, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return `api/projects/${projectId}/analytics/${path}?${qs}`
}

/** Convert a DateRange + timezone into Umami query params */
function dateRangeParams(range: DateRange): Record<string, string> {
  return {
    startAt: String(range.startDate.getTime()),
    endAt: String(range.endDate.getTime()),
    timezone: getTimezone(),
  }
}

/** Convert filter map to Umami-style filter query params (e.g. browser=eq.Chrome) */
function filterParams(filters?: Record<string, string>): Record<string, string> {
  if (!filters) return {}
  const p: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v) p[k] = `eq.${v}`
  }
  return p
}

/** Get the parsed range object for a preset value */
export function getDateRange(rangeValue: string): DateRange {
  return parseDateRange(rangeValue)
}

// ── Core queries ────────────────────────────────────────────────

/**
 * Website stats — visitors, visits, pageviews, bounces, totaltime
 * with optional comparison to previous period.
 */
export function useWebsiteStats(
  projectId?: string,
  rangeValue = '7day',
  compare: 'prev' | 'yoy' | undefined = 'prev',
  filters?: Record<string, string>,
) {
  const range = parseDateRange(rangeValue)
  return useQuery({
    queryKey: ['analytics-stats', projectId, rangeValue, compare, filters],
    queryFn: () =>
      http
        .get(
          buildUrl(projectId!, 'stats', {
            ...dateRangeParams(range),
            ...(compare ? { compare } : {}),
            ...filterParams(filters),
          }),
        )
        .json<WebsiteStatsResponse>(),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  })
}

/**
 * Pageviews time series — for the main chart.
 * Returns pageviews[] and sessions[] arrays.
 */
export function useWebsitePageviews(
  projectId?: string,
  rangeValue = '7day',
  unitOverride?: string,
  compare?: 'prev' | 'yoy',
  filters?: Record<string, string>,
) {
  const range = parseDateRange(rangeValue)
  const unit = unitOverride || range.unit
  return useQuery({
    queryKey: ['analytics-pageviews', projectId, rangeValue, unit, compare, filters],
    queryFn: () =>
      http
        .get(
          buildUrl(projectId!, 'pageviews', {
            ...dateRangeParams(range),
            unit,
            ...(compare ? { compare } : {}),
            ...filterParams(filters),
          }),
        )
        .json<PageviewsResponse>(),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  })
}

/**
 * Metrics breakdown — pages, referrers, browsers, countries, etc.
 * Returns array of { x: label, y: count, z?: percent }.
 */
export function useWebsiteMetrics(
  projectId?: string,
  type: MetricType = 'path',
  rangeValue = '7day',
  limit = 10,
  search?: string,
  filters?: Record<string, string>,
) {
  const range = parseDateRange(rangeValue)
  return useQuery({
    queryKey: ['analytics-metrics', projectId, type, rangeValue, limit, search, filters],
    queryFn: () => {
      const params: Record<string, string> = {
        ...dateRangeParams(range),
        type,
        limit: String(limit),
        ...filterParams(filters),
      }
      if (search) params.search = search
      return http.get(buildUrl(projectId!, 'metrics', params)).json<MetricItem[]>()
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}

/**
 * Active visitors — real-time count of visitors in last 5 minutes.
 */
export function useWebsiteActive(projectId?: string) {
  return useQuery({
    queryKey: ['analytics-active', projectId],
    queryFn: () =>
      http.get(`api/projects/${projectId}/analytics/active`).json<{ visitors: number }>(),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

/**
 * Real-time data — live feed of visitors, events, countries.
 */
export interface RealtimeData {
  countries: Record<string, number>
  urls: Record<string, number>
  referrers: Record<string, number>
  events: Array<{
    __type: string
    sessionId: string
    urlPath: string
    referrerDomain: string
    country: string
    eventName: string | null
  }>
  series: {
    views: TimeSeriesPoint[]
    visitors: TimeSeriesPoint[]
  }
  totals: {
    views: number
    visitors: number
    events: number
    countries: number
  }
  timestamp: number
}

export function useWebsiteRealtime(projectId?: string) {
  return useQuery({
    queryKey: ['analytics-realtime', projectId],
    queryFn: () => http.get(`api/projects/${projectId}/analytics/realtime`).json<RealtimeData>(),
    enabled: Boolean(projectId),
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}

/**
 * Sessions list — paginated session data.
 */
export interface SessionItem {
  id: string
  browser: string
  os: string
  device: string
  country: string
  city: string
  firstAt: string
  lastAt: string
  visits: number
  views: number
}

export interface SessionsResponse {
  data: SessionItem[]
  count: number
  page: number
  pageSize: number
}

export function useWebsiteSessions(
  projectId?: string,
  rangeValue = '7day',
  page = 1,
  pageSize = 20,
) {
  const range = parseDateRange(rangeValue)
  return useQuery({
    queryKey: ['analytics-sessions', projectId, rangeValue, page, pageSize],
    queryFn: () =>
      http
        .get(
          buildUrl(projectId!, 'sessions', {
            ...dateRangeParams(range),
            page: String(page),
            pageSize: String(pageSize),
          }),
        )
        .json<SessionsResponse>(),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

/**
 * Session activity — page views for a single session.
 */
export interface SessionActivity {
  urlPath: string
  referrerDomain: string
  createdAt: string
  eventName: string | null
}

export function useSessionActivity(projectId?: string, sessionId?: string) {
  return useQuery({
    queryKey: ['analytics-session-activity', projectId, sessionId],
    queryFn: () =>
      http
        .get(`api/projects/${projectId}/analytics/sessions/${sessionId}/activity`)
        .json<SessionActivity[]>(),
    enabled: Boolean(projectId) && Boolean(sessionId),
    staleTime: 30_000,
  })
}

/**
 * Events list — custom events with counts.
 */
export function useWebsiteEvents(projectId?: string, rangeValue = '7day', page = 1, pageSize = 20) {
  const range = parseDateRange(rangeValue)
  return useQuery({
    queryKey: ['analytics-events', projectId, rangeValue, page, pageSize],
    queryFn: () =>
      http
        .get(
          buildUrl(projectId!, 'events', {
            ...dateRangeParams(range),
            page: String(page),
            pageSize: String(pageSize),
          }),
        )
        .json<{ data: Array<{ eventName: string; count: number }>; count: number }>(),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

/**
 * Weekly traffic — 7-day x 24-hour heatmap data.
 */
export function useWeeklyTraffic(projectId?: string, rangeValue = '7day') {
  const range = parseDateRange(rangeValue)
  return useQuery({
    queryKey: ['analytics-weekly', projectId, rangeValue],
    queryFn: () =>
      http
        .get(
          buildUrl(projectId!, 'sessions/stats', {
            ...dateRangeParams(range),
          }),
        )
        .json<number[][]>(),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  })
}
