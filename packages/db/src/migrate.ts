import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Kysely, Migrator, sql } from 'kysely'
import { createClient } from './kysely_db'

const migrationFolder = fileURLToPath(new URL('./migrations', import.meta.url))
const migrationTable = 'kysely_migration'

function createMigrator<DB>(db: Kysely<DB>) {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  })
}

function logResults(results: Awaited<ReturnType<typeof migrate>>['results']) {
  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" was executed successfully`)
      return
    }

    if (it.status === 'Error') {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`)
    }
  })
}

async function hasMigrationTable<DB>(db: Kysely<DB>) {
  const result = await sql<{ exists: boolean }>`
    select exists(
      select 1
      from information_schema.tables
      where table_schema = current_schema()
        and table_name = ${migrationTable}
    ) as exists
  `.execute(db)

  return Boolean(result.rows[0]?.exists)
}

async function getExecutedMigrationNames<DB>(db: Kysely<DB>) {
  if (!(await hasMigrationTable(db))) {
    return []
  }

  const result = await sql<{ name: string }>`
    select name
    from "kysely_migration"
    order by "timestamp" asc, name asc
  `.execute(db)

  return result.rows.map((row) => row.name)
}

export async function getMigrationStatus<DB>(db: Kysely<DB>) {
  const migrator = createMigrator(db)
  const migrations = await migrator.getMigrations()
  const migrationNames = migrations.map((it) => it.name)
  const executedMigrations = await getExecutedMigrationNames(db)
  const unknownMigrations = executedMigrations.filter((name) => !migrationNames.includes(name))

  if (unknownMigrations.length > 0) {
    throw new Error(
      `Database contains migrations that are not present in code: ${unknownMigrations.join(', ')}`,
    )
  }

  const expectedExecuted = migrationNames.slice(0, executedMigrations.length)
  const historyMatches = expectedExecuted.every((name, i) => name === executedMigrations[i])

  if (!historyMatches) {
    throw new Error('Database migration history does not match the checked-in migration order.')
  }

  return {
    executedMigrations,
    pendingMigrations: migrationNames.slice(executedMigrations.length),
  }
}

export async function migrate<DB>(db: Kysely<DB>) {
  const migrator = createMigrator(db)
  return migrator.migrateToLatest()
}

export async function rollback<DB>(db: Kysely<DB>) {
  const migrator = createMigrator(db)
  return migrator.migrateDown()
}

export async function check<DB>(db: Kysely<DB>) {
  const { pendingMigrations } = await getMigrationStatus(db)

  if (pendingMigrations.length === 0) {
    return
  }

  throw new Error(`Pending migrations: ${pendingMigrations.join(', ')}`)
}

export async function runMigrations() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const client = createClient(url)
  const command = process.argv[2] || 'up'

  try {
    if (command === 'check') {
      console.log('🔎 Checking database migrations...')
      await check(client.db)
      console.log('✅ Database schema is up to date')
      return
    }

    console.log(
      command === 'down' ? '🔄 Rolling back latest migration...' : '🔄 Running migrations...',
    )

    const result = command === 'down' ? await rollback(client.db) : await migrate(client.db)
    const { error, results } = result

    logResults(results)

    if (error) {
      throw error
    }

    console.log('🎉 Migration completed successfully')
  } finally {
    await client.db.destroy()
  }
}

function isMain() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry) === fileURLToPath(import.meta.url)
}

if (isMain()) {
  void runMigrations().catch((error) => {
    console.error('💥 Failed to run database command')
    console.error(error)
    process.exit(1)
  })
}
