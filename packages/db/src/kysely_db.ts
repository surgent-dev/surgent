import { Kysely, PostgresDialect, type Dialect } from 'kysely'
import type { Database as DatabaseInterface } from './types'

function createDialect(): Dialect {
  const type = process.env.POSTGRES_TYPE || 'neon'
  const url = process.env.DATABASE_URL!

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
    pool: new pg.Pool({ connectionString: url }),
  })
}

export const dialect = createDialect()

export const db = new Kysely<DatabaseInterface>({ dialect })

process.on('SIGINT', async () => {
  await db.destroy()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await db.destroy()
  process.exit(0)
}) 