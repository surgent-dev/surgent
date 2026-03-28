/* eslint-disable no-console */
import 'dotenv/config'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'

const REQUIRED_TABLES = {
  website_event: 'MergeTree',
  event_data: 'MergeTree',
  session_data: 'ReplacingMergeTree',
  website_event_stats_hourly: 'AggregatingMergeTree',
  website_event_stats_hourly_mv: 'MaterializedView',
  website_revenue: 'MergeTree',
  website_revenue_mv: 'MaterializedView',
}

const REQUIRED_COLUMNS = {
  website_event: ['job_id', 'distinct_id', 'utm_source', 'li_fat_id'],
  event_data: ['job_id'],
  session_data: ['job_id', 'distinct_id'],
  website_event_stats_hourly: ['hostname', 'utm_source', 'entry_url', 'exit_url'],
}

const THIS_DIR = dirname(fileURLToPath(import.meta.url))
const CLICKHOUSE_DIR = join(THIS_DIR, '../db/clickhouse')
const MIGRATION_TABLE = '__schema_migrations'
const BASELINE = 'schema@umami-0a838649b773122cc68cbd0c3df78d4251b981c5'
const RESET = process.argv.includes('--reset')
const CHECK_ONLY = process.argv.includes('--check-only')

function success(msg) {
  console.log(chalk.greenBright(`✓ ${msg}`))
}

function info(msg) {
  console.log(chalk.blueBright(`• ${msg}`))
}

function fail(msg) {
  console.log(chalk.redBright(`✗ ${msg}`))
}

function getConfig() {
  const raw = process.env.CLICKHOUSE_URL

  if (!raw) {
    info('Skipping ClickHouse check (CLICKHOUSE_URL is not defined).')
    process.exit(0)
  }

  const url = new URL(raw)
  const db = url.pathname.replace(/^\/+/, '')

  if (!db) {
    throw new Error('CLICKHOUSE_URL must include a database name.')
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(db)) {
    throw new Error(`Unsupported ClickHouse database name: ${db}`)
  }

  return {
    baseUrl: `${url.protocol}//${url.host}/`,
    db,
    host: url.hostname,
    username: decodeURIComponent(url.username || 'default'),
    password: decodeURIComponent(url.password || ''),
  }
}

function isLocalHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function getRepairHint(cfg) {
  if (isLocalHost(cfg.host)) {
    return 'Run `bun run migrate-clickhouse` to initialize the local schema or `bun run reset-clickhouse` to rebuild it from scratch.'
  }

  return 'Run the dedicated ClickHouse migration task before starting analytics, or migrate the database to the upstream Umami layout.'
}

function getHeaders(cfg) {
  const token = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')

  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'text/plain; charset=utf-8',
  }
}

async function exec(cfg, query, database) {
  const url = new URL(cfg.baseUrl)

  if (database) {
    url.searchParams.set('database', database)
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(cfg),
    body: query,
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(text || `ClickHouse request failed with status ${res.status}.`)
  }

  return text
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((stmt) => stmt.trim())
    .filter(Boolean)
}

function escapeSqlString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

function loadSql(path) {
  return Bun.file(path).text()
}

function normalizeSql(sql, cfg) {
  return sql.replaceAll('umami.', `${cfg.db}.`)
}

function getMigrationFiles() {
  return readdirSync(join(CLICKHOUSE_DIR, 'migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

async function applyStatements(cfg, sql, database) {
  for (const stmt of splitSql(sql)) {
    await exec(cfg, stmt, database)
  }
}

async function getTables(cfg) {
  const rows = await exec(
    cfg,
    `
    SELECT name, engine
    FROM system.tables
    WHERE database = '${cfg.db}'
    FORMAT JSONEachRow
    `,
  )

  return rows
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .reduce((map, row) => {
      map[row.name] = row.engine
      return map
    }, {})
}

async function getColumns(cfg) {
  const rows = await exec(
    cfg,
    `
    SELECT table, name
    FROM system.columns
    WHERE database = '${cfg.db}'
    FORMAT JSONEachRow
    `,
    cfg.db,
  )

  return rows
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .reduce((map, row) => {
      const set = map[row.table] || new Set()
      set.add(row.name)
      map[row.table] = set
      return map
    }, {})
}

async function getAppliedMigrations(cfg) {
  const rows = await exec(
    cfg,
    `
    SELECT name
    FROM ${cfg.db}.${MIGRATION_TABLE}
    ORDER BY name
    FORMAT JSONEachRow
    `,
    cfg.db,
  )

  return new Set(
    rows
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line).name),
  )
}

function getMissingColumns(table, columns) {
  const set = columns[table] || new Set()
  return (REQUIRED_COLUMNS[table] || []).filter((name) => !set.has(name))
}

function hasAnalyticsTables(tables) {
  return Object.keys(REQUIRED_TABLES).some((name) => tables[name])
}

function assertCompatibleSchema(cfg, tables, columns) {
  const hourly = tables.website_event_stats_hourly

  if (hourly && hourly !== REQUIRED_TABLES.website_event_stats_hourly) {
    throw new Error(
      [
        'Detected an incompatible ClickHouse schema.',
        `Expected ${REQUIRED_TABLES.website_event_stats_hourly} for website_event_stats_hourly, found ${hourly}.`,
        'This usually means a hand-created or legacy schema is present.',
        getRepairHint(cfg),
      ].join(' '),
    )
  }

  for (const table of [
    'website_event',
    'event_data',
    'session_data',
    'website_event_stats_hourly',
  ]) {
    if (!tables[table]) {
      continue
    }

    const missing = getMissingColumns(table, columns)

    if (missing.length) {
      throw new Error(
        [
          `Detected an incompatible ClickHouse schema for ${table}.`,
          `Missing columns: ${missing.join(', ')}.`,
          getRepairHint(cfg),
        ].join(' '),
      )
    }
  }
}

function assertReady(tables, columns) {
  for (const [name, engine] of Object.entries(REQUIRED_TABLES)) {
    if (tables[name] !== engine) {
      throw new Error(`Missing or invalid ClickHouse object ${name}. Expected engine ${engine}.`)
    }
  }

  for (const table of Object.keys(REQUIRED_COLUMNS)) {
    const missing = getMissingColumns(table, columns)

    if (missing.length) {
      throw new Error(`Missing ClickHouse columns for ${table}: ${missing.join(', ')}.`)
    }
  }
}

async function ensureMigrationTable(cfg) {
  await exec(
    cfg,
    `
    CREATE TABLE IF NOT EXISTS ${cfg.db}.${MIGRATION_TABLE}
    (
      name String,
      source String,
      applied_at DateTime('UTC')
    )
    ENGINE = ReplacingMergeTree
    ORDER BY name
    `,
    cfg.db,
  )
}

async function recordMigrations(cfg, names, source) {
  if (!names.length) {
    return
  }

  const values = names
    .map((name) => `('${escapeSqlString(name)}', '${escapeSqlString(source)}', now())`)
    .join(', ')

  await exec(
    cfg,
    `INSERT INTO ${cfg.db}.${MIGRATION_TABLE} (name, source, applied_at) VALUES ${values}`,
    cfg.db,
  )
}

async function applySchema(cfg) {
  const path = join(CLICKHOUSE_DIR, 'schema.sql')
  const sql = normalizeSql(await loadSql(path), cfg)
  await applyStatements(cfg, sql, cfg.db)
}

async function applyMigration(cfg, name) {
  const path = join(CLICKHOUSE_DIR, 'migrations', name)
  const sql = normalizeSql(await loadSql(path), cfg)
  await applyStatements(cfg, sql, cfg.db)
}

async function initializeMigrationHistory(cfg, files) {
  await ensureMigrationTable(cfg)
  await recordMigrations(cfg, [BASELINE, ...files], 'baseline')
}

async function resetDatabase(cfg) {
  if (!isLocalHost(cfg.host)) {
    throw new Error(
      [
        'Refusing to reset a non-local ClickHouse database.',
        'If you need to rebuild a remote schema, do it explicitly with a migration or one-off admin task.',
      ].join(' '),
    )
  }

  info(`Resetting local ClickHouse database ${cfg.db}.`)
  await exec(cfg, `DROP DATABASE IF EXISTS ${cfg.db} SYNC`)
  success(`ClickHouse database reset: ${cfg.db}`)
}

;(async () => {
  try {
    const cfg = getConfig()
    const files = getMigrationFiles()

    if (RESET) {
      await resetDatabase(cfg)
    }

    await exec(cfg, `CREATE DATABASE IF NOT EXISTS ${cfg.db}`)
    success(`ClickHouse database ready: ${cfg.db}`)

    const beforeTables = await getTables(cfg)
    const beforeColumns = await getColumns(cfg)

    if (!hasAnalyticsTables(beforeTables)) {
      if (CHECK_ONLY) {
        throw new Error(`ClickHouse schema is missing. ${getRepairHint(cfg)}`)
      }

      await applySchema(cfg)
      success('ClickHouse schema applied from schema.sql.')
      await initializeMigrationHistory(cfg, files)
      success('ClickHouse migration history initialized.')
    } else {
      assertCompatibleSchema(cfg, beforeTables, beforeColumns)

      const migrationTable = beforeTables[MIGRATION_TABLE]

      if (!migrationTable) {
        if (CHECK_ONLY) {
          throw new Error(`ClickHouse migration history is missing. ${getRepairHint(cfg)}`)
        }

        await initializeMigrationHistory(cfg, files)
        success('ClickHouse migration history initialized.')
      }

      const applied = migrationTable ? await getAppliedMigrations(cfg) : new Set()

      if (migrationTable && !applied.size) {
        if (CHECK_ONLY) {
          throw new Error(`ClickHouse migration history is empty. ${getRepairHint(cfg)}`)
        }

        await recordMigrations(cfg, [BASELINE, ...files], 'baseline')
        success('ClickHouse migration history initialized.')
      }

      const known = migrationTable ? await getAppliedMigrations(cfg) : new Set([BASELINE, ...files])
      const pending = files.filter((name) => !known.has(name))

      if (pending.length) {
        if (CHECK_ONLY) {
          throw new Error(
            `Pending ClickHouse migrations: ${pending.join(', ')}. ${getRepairHint(cfg)}`,
          )
        }

        for (const name of pending) {
          await applyMigration(cfg, name)
          await recordMigrations(cfg, [name], 'migration')
          success(`Applied ClickHouse migration: ${name}`)
        }
      }
    }

    const afterTables = await getTables(cfg)
    const afterColumns = await getColumns(cfg)

    assertReady(afterTables, afterColumns)
    success(CHECK_ONLY ? 'ClickHouse schema check passed.' : 'ClickHouse schema is ready.')
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
})()
