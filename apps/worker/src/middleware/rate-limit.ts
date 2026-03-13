import type { Context, Next } from 'hono'

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as { id?: string } | undefined
    const key = `${c.req.path}:${user?.id || c.req.header('x-forwarded-for') || 'anon'}`
    const now = Date.now()

    let bucket = buckets.get(key)
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count++
    if (bucket.count > maxRequests) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }

    await next()
  }
}
