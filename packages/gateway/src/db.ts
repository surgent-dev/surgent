import { createDb } from '@repo/db'
import type { Bindings } from './types'

let db: ReturnType<typeof createDb> | null = null

export function getDb(env: Bindings) {
  if (!db) {
    const url = env.HYPERDRIVE?.connectionString
    if (!url) {
      throw new Error('DATABASE_URL not set')
    }
    console.log(`[gateway/db] initializing db with type: ${env.POSTGRES_TYPE}`)
    db = createDb(url, env.POSTGRES_TYPE)
  }
  return db
}
