import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Kysely, Migrator } from 'kysely'
import { createClient } from './kysely_db'

const migrationFolder = fileURLToPath(new URL('./migrations', import.meta.url))

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

export async function migrate<DB>(db: Kysely<DB>) {
  const migrator = createMigrator(db)
  return migrator.migrateToLatest()
}

export async function rollback<DB>(db: Kysely<DB>) {
  const migrator = createMigrator(db)
  return migrator.migrateDown()
}

export async function runMigrations() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const client = createClient(url, process.env.POSTGRES_TYPE ?? 'postgres')

  const command = process.argv[2]

  let result
  if (command === 'down') {
    console.log('🔄 Rolling back latest migration...')
    result = await rollback(client.db)
  } else {
    console.log('🔄 Running migrations...')
    result = await migrate(client.db)
  }

  const { error, results } = result

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('💥 Failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await client.db.destroy()
  console.log('🎉 Migration completed successfully')
}

function isMain() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry) === fileURLToPath(import.meta.url)
}

if (isMain()) void runMigrations()
