/**
 * Date range utilities — 1:1 port from Umami's src/lib/date.ts
 */
import {
  addDays,
  addHours,
  addMonths,
  addYears,
  subHours,
  subDays,
  subMonths,
  subYears,
  startOfHour,
  startOfDay,
  startOfMonth,
  startOfYear,
  endOfHour,
  endOfDay,
  endOfMonth,
  endOfYear,
  differenceInMinutes,
  differenceInHours,
  differenceInCalendarMonths,
  isBefore,
} from 'date-fns'

export interface DateRange {
  startDate: Date
  endDate: Date
  value: string
  unit: string
  num: number
  offset: number
}

export function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function parseDateValue(value: string) {
  const match = value.match(/^(?<num>[0-9-]+)(?<unit>hour|day|week|month|year)$/)
  if (!match?.groups) return { num: 1, unit: 'day' }
  return { num: +(match.groups.num ?? 1), unit: match.groups.unit ?? 'day' }
}

export function getMinimumUnit(startDate: Date, endDate: Date) {
  if (differenceInMinutes(endDate, startDate) <= 60) return 'minute'
  if (differenceInHours(endDate, startDate) <= 48) return 'hour'
  if (differenceInCalendarMonths(endDate, startDate) <= 6) return 'day'
  if (differenceInCalendarMonths(endDate, startDate) <= 24) return 'month'
  return 'year'
}

export function parseDateRange(value: string): DateRange {
  const now = new Date()
  const { num, unit } = parseDateValue(value)

  switch (unit) {
    case 'hour':
      return {
        startDate: subHours(startOfHour(now), num),
        endDate: endOfHour(now),
        unit: 'hour',
        offset: 0,
        num,
        value,
      }
    case 'day':
      return {
        startDate: subDays(startOfDay(now), num),
        endDate: endOfDay(now),
        unit: num ? 'day' : 'hour',
        offset: 0,
        num,
        value,
      }
    case 'month':
      return {
        startDate: subMonths(startOfMonth(now), num),
        endDate: endOfMonth(now),
        unit: num ? 'month' : 'day',
        offset: 0,
        num,
        value,
      }
    case 'year':
      return {
        startDate: subYears(startOfYear(now), num),
        endDate: endOfYear(now),
        unit: 'month',
        offset: 0,
        num,
        value,
      }
    default:
      return {
        startDate: subDays(startOfDay(now), 7),
        endDate: endOfDay(now),
        unit: 'day',
        offset: 0,
        num: 7,
        value: '7day',
      }
  }
}

/** Shift a date range forward or backward by its own span. */
export function getOffsetDateRange(range: DateRange, direction: 1 | -1): DateRange {
  const { num, value } = range
  const { unit: originalUnit } = parseDateValue(value)
  const change = num * direction

  let startDate: Date
  let endDate: Date

  switch (originalUnit) {
    case 'hour':
      startDate = addHours(range.startDate, change)
      endDate = addHours(range.endDate, change)
      break
    case 'day':
      startDate = addDays(range.startDate, change)
      endDate = addDays(range.endDate, change)
      break
    case 'month':
      startDate = addMonths(range.startDate, change)
      endDate = addMonths(range.endDate, change)
      break
    case 'year':
      startDate = addYears(range.startDate, change)
      endDate = addYears(range.endDate, change)
      break
    default:
      startDate = addDays(range.startDate, change)
      endDate = addDays(range.endDate, change)
  }

  return { ...range, startDate, endDate, offset: range.offset + direction }
}

/** Check if we can go forward (end date would be in the future). */
export function canGoForward(range: DateRange): boolean {
  const next = getOffsetDateRange(range, 1)
  return isBefore(next.endDate, new Date())
}
