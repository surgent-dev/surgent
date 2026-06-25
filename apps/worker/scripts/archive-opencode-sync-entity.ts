import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'
import { gzipSync } from 'node:zlib'

type EntityRow = {
  projectId: string
  userId: string
  organizationId: string
  entity: string
  id: string
  sessionId: string | null
  messageId: string | null
  payload: unknown
  createdAt: string
  updatedAt: string
}

const env = process.env

function required(name: string) {
  const value = env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function int(name: string, fallback: number) {
  const value = Number(env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function cleanPrefix(value: string) {
  return value.replace(/^\/+|\/+$/g, '')
}

const databaseUrl = required('DATABASE_URL')
const bucket = required('S3_BUCKET')
const endpoint = required('S3_ENDPOINT')
const accessKeyId = required('S3_ACCESS_KEY_ID')
const secretAccessKey = required('S3_SECRET_ACCESS_KEY')
const region = env.S3_REGION || 'auto'
const batchRows = int('ARCHIVE_BATCH_ROWS', 5_000)
const limitBatches = int('ARCHIVE_LIMIT_BATCHES', Number.MAX_SAFE_INTEGER)
const prefix = cleanPrefix(
  env.ARCHIVE_PREFIX || `archives/opencode-sync-entity/${new Date().toISOString().slice(0, 10)}`,
)

const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
})

async function putObject(
  key: string,
  body: string | Buffer,
  contentType: string,
  metadata = {},
  contentEncoding?: string,
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentEncoding: contentEncoding,
      Metadata: metadata,
    }),
  )
}

async function putRows(key: string, rows: EntityRow[]) {
  const body = gzipSync(Buffer.from(rows.map((row) => JSON.stringify(row)).join('\n') + '\n'))
  await putObject(
    key,
    body,
    'application/x-ndjson',
    {
      rows: String(rows.length),
      firstProjectId: rows[0]!.projectId,
      firstEntity: rows[0]!.entity,
      lastProjectId: rows.at(-1)!.projectId,
      lastEntity: rows.at(-1)!.entity,
    },
    'gzip',
  )
  return body.byteLength
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  await client.query(`set enable_seqscan = off`)
  await client.query(`set statement_timeout = '10min'`)

  let projectId = env.ARCHIVE_START_PROJECT_ID || '00000000-0000-0000-0000-000000000000'
  let entity = env.ARCHIVE_START_ENTITY || ''
  let id = env.ARCHIVE_START_ID || ''
  const startedAt = new Date().toISOString()
  let batch = 0
  let rowsArchived = 0
  let bytesUploaded = 0

  console.log(JSON.stringify({ event: 'archive_start', prefix, batchRows }))

  while (batch < limitBatches) {
    const result = await client.query<EntityRow>(
      `
        select
          "projectId"::text as "projectId",
          "userId"::text as "userId",
          "organizationId"::text as "organizationId",
          entity,
          id,
          "sessionId",
          "messageId",
          payload,
          "createdAt"::text as "createdAt",
          "updatedAt"::text as "updatedAt"
        from opencode_sync_entity
        where ("projectId", entity, id) > ($1::uuid, $2::text, $3::text)
        order by "projectId" asc, entity asc, id asc
        limit $4
      `,
      [projectId, entity, id, batchRows],
    )

    if (result.rows.length === 0) break

    const first = result.rows[0]!
    const last = result.rows.at(-1)!
    const key = `${prefix}/parts/opencode-sync-entity-${String(batch + 1).padStart(5, '0')}.jsonl.gz`
    const uploadedBytes = await putRows(key, result.rows)

    projectId = last.projectId
    entity = last.entity
    id = last.id
    batch++
    rowsArchived += result.rows.length
    bytesUploaded += uploadedBytes

    console.log(
      JSON.stringify({
        event: 'archive_part',
        key,
        rows: result.rows.length,
        uploadedBytes,
        first: { projectId: first.projectId, entity: first.entity, id: first.id },
        last: { projectId: last.projectId, entity: last.entity, id: last.id },
      }),
    )
  }

  const manifest = {
    table: 'opencode_sync_entity',
    prefix,
    batchRows,
    limitBatches: limitBatches === Number.MAX_SAFE_INTEGER ? null : limitBatches,
    startedAt,
    finishedAt: new Date().toISOString(),
    lastKey: { projectId, entity, id },
    rowsArchived,
    bytesUploaded,
    complete: batch < limitBatches,
  }

  await putObject(
    `${prefix}/manifest-${Date.now()}.json`,
    JSON.stringify(manifest, null, 2),
    'application/json',
  )
  console.log(JSON.stringify({ event: 'archive_done', ...manifest }))
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
