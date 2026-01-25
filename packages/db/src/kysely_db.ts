import { Kysely, PostgresDialect, type Dialect } from 'kysely'
import type { Database as DatabaseInterface } from './types'

export function createDialect(url: string, type = 'neon'): Dialect {
  if (type === 'neon') {
    const { neon } = require('@neondatabase/serverless')
    const { NeonDialect } = require('kysely-neon')
    return new NeonDialect({ neon: neon(url) })
  }

  if (type === 'planetscale') {
    const { PlanetScaleDialect } = require('kysely-planetscale')
    return new PlanetScaleDialect({ url })
  }

  const pg = require('pg')
  return new PostgresDialect({
    pool: new pg.Pool({
      connectionString: url,
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }),
  })
}

export function createDbFromDialect(dialect: Dialect) {
  return new Kysely<DatabaseInterface>({ dialect })
}

export function createClient(url: string, type?: string) {
  const dialect = createDialect(url, type)
  const db = createDbFromDialect(dialect)
  return { db, dialect }
}

export function createDb(url: string, type?: string) {
  return createClient(url, type).db
}
