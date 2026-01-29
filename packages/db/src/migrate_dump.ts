import * as path from 'path'
import { migrate } from './migrate'
import { createClient } from './kysely_db'

const OUTPUT_PATH = path.resolve(__dirname, '../../../apps/pay/migrations/0001_schema.sql')

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL not set')
  }

  const client = createClient(url, process.env.POSTGRES_TYPE)

  console.log('🔄 Running migrations...')
  const { error, results } = await migrate(client.db)

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" was executed successfully`)
    }
    if (it.status === 'Error') {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('💥 Failed to migrate')
    console.error(error)
    await client.db.destroy()
    process.exit(1)
  }

  await client.db.destroy()
  console.log('🎉 Migrations completed')

  console.log('📦 Dumping schema...')
  // Parse URL to avoid exposing credentials in process arguments (visible via `ps`)
  const dbUrl = new URL(url)
  const pgEnv = {
    ...process.env,
    PGHOST: dbUrl.hostname,
    PGPORT: dbUrl.port || '5432',
    PGUSER: decodeURIComponent(dbUrl.username),
    PGPASSWORD: decodeURIComponent(dbUrl.password),
    PGDATABASE: decodeURIComponent(dbUrl.pathname.slice(1)),
  }

  const proc = Bun.spawn(
    [
      'pg_dump',
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      '--exclude-schema=_sqlx_test',
      '--exclude-table=_sqlx_migrations',
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      env: pgEnv,
    },
  )

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (code !== 0) {
    console.error('💥 pg_dump failed')
    console.error(stderr)
    process.exit(1)
  }

  // Filter out lines that break sqlx test compatibility:
  // - psql meta-commands (backslash commands)
  // - search_path reset (breaks sqlx's internal _sqlx_migrations table lookup)
  const filtered = stdout
    .split('\n')
    .filter((line) => !line.startsWith('\\'))
    .filter((line) => !line.includes("set_config('search_path'"))
    .join('\n')

  await Bun.write(OUTPUT_PATH, filtered)
  console.log(`✅ Schema dumped to ${OUTPUT_PATH}`)
}

run()
