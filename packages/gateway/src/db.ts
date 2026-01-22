import { createDb } from '@repo/db'
import type { Bindings } from './types'

let db: ReturnType<typeof createDb> | null = null

export function getDb(env: Bindings) {
  if (!db) {
    const url = env.HYPERDRIVE?.connectionString
    if (!url) {
      throw new Error('DATABASE_URL not set')
    }
    db = createDb(url, env.POSTGRES_TYPE)
  }
  return db
}
