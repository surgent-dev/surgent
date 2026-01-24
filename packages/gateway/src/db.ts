import { createDb } from '@repo/db'
import type { Bindings } from './types'

let db: ReturnType<typeof createDb> | null = null

export function getDb(env: Bindings) {
  if (!db) {
    const url = env.HYPERDRIVE?.connectionString
    if (!url) {
      throw new Error('HYPERDRIVE not configured')
    }
    db = createDb(url, 'pg')
  }
  return db
}
