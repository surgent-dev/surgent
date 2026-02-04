import * as path from 'path'
import { promises as fs } from 'fs'
import { Migrator, FileMigrationProvider, Kysely } from 'kysely'
import { createClient } from './kysely_db'

export async function migrate(db: Kysely<any>) {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const result = await migrator.migrateToLatest()
  return result
}

export async function rollback(db: Kysely<any>) {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const result = await migrator.migrateDown()
  return result
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

if (import.meta.main) runMigrations()
