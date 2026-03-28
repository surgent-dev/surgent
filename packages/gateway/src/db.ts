import { createDb } from '@repo/db'
import type { Bindings } from './types'

// No singleton - create fresh db per request in serverless
// Hyperdrive handles connection pooling in production
export function getDb(env: Bindings) {
  const url = env.HYPERDRIVE?.connectionString
  if (!url) {
    throw new Error('HYPERDRIVE not configured')
  }
  return createDb(url)
}
