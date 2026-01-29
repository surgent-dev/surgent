import { sql, type Kysely } from 'kysely'
import type { Database } from '@repo/db'
import type { UsageInfo } from './provider/provider'
import type { ZenData } from './zenData'

export function createTrialLimiter(
  db: Kysely<Database>,
  trial: ZenData.Trial | undefined,
  ip: string,
  client: string,
) {
  if (!trial) return
  if (!ip) return

  const limit =
    trial.limits.find((limit) => limit.client === client)?.limit ??
    trial.limits.find((limit) => limit.client === undefined)?.limit
  if (!limit) return

  let _isTrial: boolean

  return {
    isTrial: async () => {
      const data = await db.selectFrom('ip').select('usage').where('ip', '=', ip).executeTakeFirst()

      _isTrial = (data?.usage ?? 0) < limit
      return _isTrial
    },
    track: async (usageInfo: UsageInfo) => {
      if (!_isTrial) return
      const usage =
        usageInfo.inputTokens +
        usageInfo.outputTokens +
        (usageInfo.reasoningTokens ?? 0) +
        (usageInfo.cacheReadTokens ?? 0) +
        (usageInfo.cacheWrite5mTokens ?? 0) +
        (usageInfo.cacheWrite1hTokens ?? 0)
      await db
        .insertInto('ip')
        .values({ ip, usage })
        .onConflict((oc) =>
          oc.column('ip').doUpdateSet({ usage: sql`${sql.ref('ip.usage')} + ${usage}` }),
        )
        .execute()
    },
  }
}
