import { Kysely, PostgresDialect, type Dialect } from 'kysely'
import type { Database as DatabaseInterface } from './types'

export function createDialect(url: string, type?: string): Dialect {
  type = type || process.env.POSTGRES_TYPE || 'pg'

  if (type === 'neon') {
    const { neon } = require('@neondatabase/serverless')
    const { NeonDialect } = require('kysely-neon')
    return new NeonDialect({ neon: neon(url) })
  }

  // Serverless-friendly pool config:
  // - max:1 prevents pool exhaustion in workerd local dev
  // - In production, Hyperdrive handles connection pooling
  const pg = require('pg')
  return new PostgresDialect({
    pool: new pg.Pool({
      connectionString: url,
      max: 1,
      idleTimeoutMillis: 0,
      allowExitOnIdle: true,
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
