import { Kysely, PostgresDialect, type Dialect } from 'kysely'
import type { Database as DatabaseInterface } from './types'

export function createDialect(url: string, type?: string): Dialect {
  type = type || process.env.POSTGRES_TYPE || 'pg'

  if (type === 'neon') {
    const { neon } = require('@neondatabase/serverless')
    const { NeonDialect } = require('kysely-neon')
    return new NeonDialect({ neon: neon(url) })
  }

  const pg = require('pg')
  return new PostgresDialect({
    pool: new pg.Pool({
      connectionString: url,
      max: 1, // Single connection - Hyperdrive handles pooling in prod
      connectionTimeoutMillis: 10000, // Fail fast, don't hang
      idleTimeoutMillis: 0, // Close immediately when idle
    }),
  })
}

export function createDbFromDialect(dialect: Dialect) {
  return new Kysely<DatabaseInterface>({ dialect })
}

export function createClient(url: string, type: string) {
  const dialect = createDialect(url, type)
  const db = createDbFromDialect(dialect)
  return { db, dialect }
}

export function createDb(url: string, type: string) {
  return createClient(url, type).db
}
