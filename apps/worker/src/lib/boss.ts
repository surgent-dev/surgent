import { PgBoss } from 'pg-boss'
import { config } from '@/lib/config'

let boss: PgBoss | null = null

export function getBoss(): PgBoss {
  if (!boss) {
    if (!config.database.url) throw new Error('DATABASE_URL not set')
    boss = new PgBoss({
      connectionString: config.database.url,
      max: 3,
    })
  }

  return boss
}

export async function stopBoss(): Promise<void> {
  if (!boss) return
  await boss.stop({ graceful: true, timeout: 10_000 })
}
