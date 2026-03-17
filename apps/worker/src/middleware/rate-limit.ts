import type { Context, Next } from 'hono'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

function getClientKey(c: Context) {
  const user = c.get('user') as { id?: string } | undefined
  if (user?.id) return user.id

  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]!.trim()
  }

  return c.req.header('cf-connecting-ip') || 'anon'
}

function pruneBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key)
    }
  }

  if (buckets.size <= MAX_BUCKETS) return

  const overflow = buckets.size - MAX_BUCKETS
  let i = 0
  for (const key of buckets.keys()) {
    if (i >= overflow) return
    buckets.delete(key)
    i++
  }
}

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const key = `${c.req.path}:${getClientKey(c)}`
    const now = Date.now()
    pruneBuckets(now)

    const current = buckets.get(key)
    const bucket =
      !current || now >= current.resetAt
        ? { count: 1, resetAt: now + windowMs }
        : { count: current.count + 1, resetAt: current.resetAt }

    buckets.delete(key)
    buckets.set(key, bucket)

    if (bucket.count > maxRequests) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }

    await next()
  }
}
