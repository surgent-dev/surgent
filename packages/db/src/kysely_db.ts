import pg from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import type { Database as DatabaseInterface } from './types'

export function createDialect(url: string): PostgresDialect {
  // Serverless-friendly pool config:
  // - max:1 prevents pool exhaustion in workerd local dev
  // - In production, Hyperdrive handles connection pooling
  return new PostgresDialect({
    pool: new pg.Pool({
      connectionString: url,
      max: 1,
      idleTimeoutMillis: 0,
      allowExitOnIdle: true,
    }),
  })
}

export function createDbFromDialect(dialect: PostgresDialect) {
  return new Kysely<DatabaseInterface>({ dialect })
}

export function createClient(url: string) {
  const dialect = createDialect(url)
  const db = createDbFromDialect(dialect)
  return { db, dialect }
}

export function createDb(url: string) {
  return createClient(url).db
}
