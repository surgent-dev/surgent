import { sql, type Kysely } from 'kysely'
import type { Database } from '@repo/db'
import { RateLimitError } from './error'
import { createLogger } from './logger'

export function createRateLimiter(db: Kysely<Database>, limit: number | undefined, rawIp: string, stage?: string) {
  if (!limit) return

  const logger = createLogger(stage)
  const ip = !rawIp.length ? 'unknown' : rawIp
  const now = Date.now()
  const intervals = [buildYYYYMMDDHH(now), buildYYYYMMDDHH(now - 3_600_000), buildYYYYMMDDHH(now - 7_200_000)]

  return {
    track: async () => {
      await db
        .insertInto('ip_rate_limit')
        .values({ ip, interval: intervals[0], count: 1 })
        .onConflict((oc) =>
          oc.columns(['ip', 'interval']).doUpdateSet({ count: sql`${sql.ref('ip_rate_limit.count')} + 1` }),
        )
        .execute()
    },
    check: async () => {
      const rows = await db
        .selectFrom('ip_rate_limit')
        .select('count')
        .where('ip', '=', ip)
        .where('interval', 'in', intervals)
        .execute()
      const total = rows.reduce((sum, r) => sum + r.count, 0)
      logger.debug(`rate limit total: ${total}`)
      if (total >= limit) throw new RateLimitError(`Rate limit exceeded. Please try again later.`)
    },
  }
}

function buildYYYYMMDDHH(timestamp: number) {
  return new Date(timestamp)
    .toISOString()
    .replace(/[^0-9]/g, '')
    .substring(0, 10)
}
