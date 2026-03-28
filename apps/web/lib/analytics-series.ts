import { getTimezone } from '@/lib/analytics-date'

type SeriesPoint = {
  x: string
  y: number
}

type SeriesUnit = 'minute' | 'hour' | 'day' | 'month' | 'year'

function toUnit(unit: string): SeriesUnit {
  if (unit === 'minute') return 'minute'
  if (unit === 'hour') return 'hour'
  if (unit === 'month') return 'month'
  if (unit === 'year') return 'year'
  return 'day'
}

function bucketKey(value: string, unit: SeriesUnit): string {
  const text = value.replace(' ', 'T')
  if (unit === 'minute') return text.slice(0, 16)
  if (unit === 'hour') return text.slice(0, 13)
  if (unit === 'month') return text.slice(0, 7)
  if (unit === 'year') return text.slice(0, 4)
  return text.slice(0, 10)
}

function sortedKeys(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}

/** Human-readable label for chart X-axis. */
function bucketLabel(key: string, unit: SeriesUnit): string {
  if (unit === 'year') return key

  // Build a UTC Date from the key so formatting is stable (no shifting).
  const parts = key.split(/[-T:]/).map(Number)
  const utcDate = new Date(
    Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1, parts[3] ?? 12, parts[4] ?? 0),
  )

  if (unit === 'minute') {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(utcDate)
  }
  if (unit === 'hour') {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', timeZone: 'UTC' }).format(utcDate)
  }
  if (unit === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(utcDate)
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate)
}

/**
 * Merge two backend-normalized series into chart points.
 * The backend owns bucket generation; the frontend only aligns by key and formats labels.
 */
export function mergeTimeSeries(left: SeriesPoint[], right: SeriesPoint[], unit: string) {
  const u = toUnit(unit)
  const leftMap = new Map(left.map((p) => [bucketKey(p.x, u), p.y]))
  const rightMap = new Map(right.map((p) => [bucketKey(p.x, u), p.y]))
  const keys = sortedKeys([
    ...left.map((p) => bucketKey(p.x, u)),
    ...right.map((p) => bucketKey(p.x, u)),
  ])

  return keys.map((key) => {
    return {
      key,
      label: bucketLabel(key, u),
      left: leftMap.get(key) ?? 0,
      right: rightMap.get(key) ?? 0,
    }
  })
}

/**
 * Downsample a series into a fixed number of averaged buckets for sparklines.
 */
export function getSparklineSeries(data: SeriesPoint[], size = 24) {
  if (!data.length) return []

  const count = Math.min(size, data.length)

  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * data.length) / count)
    const end = Math.max(start + 1, Math.floor(((i + 1) * data.length) / count))
    const slice = data.slice(start, end)
    const total = slice.reduce((sum, point) => sum + point.y, 0)
    return { y: total / slice.length }
  })
}

/** Extract day-of-week + hour from a timestamp string for the weekly heatmap. */
export function getSeriesDayHour(x: string, timezone = getTimezone()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    hourCycle: 'h23',
    timeZone: timezone,
  }).formatToParts(new Date(x))
  const day = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')

  return { day, hour }
}
