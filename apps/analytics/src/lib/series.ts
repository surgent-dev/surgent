import { eachHourOfInterval, eachMinuteOfInterval } from 'date-fns'
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'
import { isValidTimezone, normalizeTimezone } from '@/lib/date'
import type { QueryFilters } from '@/lib/types'

type SeriesPoint = {
  x: string | Date
  y: number
}

type SeriesUnit = 'minute' | 'hour' | 'day' | 'month' | 'year'

function getSeriesUnit(unit?: string): SeriesUnit {
  if (unit === 'minute') return 'minute'
  if (unit === 'hour') return 'hour'
  if (unit === 'month') return 'month'
  if (unit === 'year') return 'year'
  return 'day'
}

function getSeriesKeySteps(startKey: string, endKey: string, unit: SeriesUnit) {
  if (unit === 'year') {
    const start = Number(startKey)
    const end = Number(endKey)

    return Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
  }

  if (unit === 'month') {
    const [startYear, startMonth] = startKey.split('-').map(Number)
    const [endYear, endMonth] = endKey.split('-').map(Number)
    const steps: string[] = []
    const start = startYear * 12 + (startMonth - 1)
    const end = endYear * 12 + (endMonth - 1)

    for (const value of Array.from({ length: end - start + 1 }, (_, i) => start + i)) {
      const year = Math.floor(value / 12)
      const month = String((value % 12) + 1).padStart(2, '0')
      steps.push(`${year}-${month}`)
    }

    return steps
  }

  const start = new Date(`${startKey}T00:00:00Z`).getTime()
  const end = new Date(`${endKey}T00:00:00Z`).getTime()

  return Array.from({ length: Math.floor((end - start) / 86400000) + 1 }, (_, i) =>
    new Date(start + i * 86400000).toISOString().slice(0, 10),
  )
}

function getSeriesSteps(startDate: Date, endDate: Date, unit: SeriesUnit, timezone: string) {
  if (unit === 'minute') return eachMinuteOfInterval({ start: startDate, end: endDate })
  if (unit === 'hour') return eachHourOfInterval({ start: startDate, end: endDate })
  return getSeriesKeySteps(
    getSeriesKey(startDate, unit, timezone),
    getSeriesKey(endDate, unit, timezone),
    unit,
  )
}

function getSeriesKey(value: string | Date, unit: SeriesUnit, timezone: string) {
  if (value instanceof Date) {
    if (unit === 'minute') return formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:mm")
    if (unit === 'hour') return formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH")
    if (unit === 'month') return formatInTimeZone(value, timezone, 'yyyy-MM')
    if (unit === 'year') return formatInTimeZone(value, timezone, 'yyyy')
    return formatInTimeZone(value, timezone, 'yyyy-MM-dd')
  }

  const text = String(value).replace(' ', 'T')
  if (unit === 'minute') return text.slice(0, 16)
  if (unit === 'hour') return text.slice(0, 13)
  if (unit === 'month') return text.slice(0, 7)
  if (unit === 'year') return text.slice(0, 4)
  return text.slice(0, 10)
}

function getSeriesValue(value: Date, unit: SeriesUnit, timezone: string) {
  if (unit === 'minute') return formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:mm:00XXX")
  if (unit === 'hour') return formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:00:00XXX")
  if (unit === 'month') return formatInTimeZone(value, timezone, "yyyy-MM-01'T'00:00:00XXX")
  if (unit === 'year') return formatInTimeZone(value, timezone, "yyyy-01-01'T'00:00:00XXX")
  return formatInTimeZone(value, timezone, "yyyy-MM-dd'T'00:00:00XXX")
}

function getSeriesDate(value: string | Date, unit: SeriesUnit, timezone: string) {
  if (value instanceof Date) return value
  const localValue = value
  if (unit === 'month') {
    return zonedTimeToUtc(`${localValue}-01T00:00:00`, timezone)
  }
  if (unit === 'year') {
    return zonedTimeToUtc(`${localValue}-01-01T00:00:00`, timezone)
  }
  return zonedTimeToUtc(`${localValue}T00:00:00`, timezone)
}

export function normalizeTimeSeries(
  data: SeriesPoint[],
  filters: Pick<QueryFilters, 'startDate' | 'endDate' | 'unit' | 'timezone'>,
) {
  const { startDate, endDate } = filters

  if (!startDate || !endDate) {
    return data.map(({ x, y }) => ({ x: String(x), y }))
  }

  const timezone = normalizeTimezone(filters.timezone || 'UTC')
  const safeTimezone = isValidTimezone(timezone) ? timezone : 'UTC'
  const unit = getSeriesUnit(filters.unit)
  const steps = getSeriesSteps(startDate, endDate, unit, safeTimezone)
  const points = new Map(data.map((point) => [getSeriesKey(point.x, unit, safeTimezone), point.y]))

  return steps.map((step) => {
    const key = getSeriesKey(step, unit, safeTimezone)
    const date = getSeriesDate(step, unit, safeTimezone)

    return {
      x: getSeriesValue(date, unit, safeTimezone),
      y: points.get(key) ?? 0,
    }
  })
}
