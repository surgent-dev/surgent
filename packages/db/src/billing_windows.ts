export type BillingAllowanceWindowArgs = {
  tier: string | null
  interval: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function getAnchoredMonthlyBounds(now: Date, anchorDate: Date) {
  const day = anchorDate.getUTCDate()
  const hh = anchorDate.getUTCHours()
  const mm = anchorDate.getUTCMinutes()
  const ss = anchorDate.getUTCSeconds()
  const ms = anchorDate.getUTCMilliseconds()

  function anchor(year: number, month: number) {
    const max = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(day, max), hh, mm, ss, ms))
  }

  function shift(year: number, month: number, delta: number) {
    const total = year * 12 + month + delta
    return [Math.floor(total / 12), ((total % 12) + 12) % 12] as const
  }

  let y = now.getUTCFullYear()
  let m = now.getUTCMonth()
  let start = anchor(y, m)
  if (start > now) {
    ;[y, m] = shift(y, m, -1)
    start = anchor(y, m)
  }
  const [ny, nm] = shift(y, m, 1)
  const end = anchor(ny, nm)
  return { start, end }
}

export function getAllowanceWindow(args: BillingAllowanceWindowArgs, now = new Date()) {
  if (args.tier === 'free') {
    const start = startOfMonth(now)
    return {
      start,
      end: addMonths(start, 1),
    }
  }

  if (!args.currentPeriodStart) {
    const start = startOfMonth(now)
    return {
      start,
      end: addMonths(start, 1),
    }
  }

  if (args.interval === 'year') {
    return getAnchoredMonthlyBounds(now, args.currentPeriodStart)
  }

  return {
    start: args.currentPeriodStart,
    end: args.currentPeriodEnd ?? addMonths(args.currentPeriodStart, 1),
  }
}

export function sameAllowanceWindowStart(left: Date | null, right: Date | null) {
  if (!left || !right) return false
  return left.getTime() === right.getTime()
}
