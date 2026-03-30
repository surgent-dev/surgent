import { createHash } from 'crypto'
import { createLogger } from '@/lib/logger'
import { storage } from '@/lib/storage'
import { shellQuote } from '@/lib/utils'
import { getProvider } from '@/lib/sandbox'
import * as ProjectService from '@/services/projects'
import type { ProjectMetadata } from '@repo/db'
import { workspacePath } from '@/lib/sandbox'

const log = createLogger('marketplace-snapshot')

function snapshotKey(listingId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `snapshots/${listingId}/${timestamp}-${random}.tar.gz`
}

export async function createSnapshot(
  listingId: string,
  projectId: string,
): Promise<{ snapshotId: string; storageKey: string }> {
  const sandboxRow = await ProjectService.getSandboxByProjectId(projectId)
  if (!sandboxRow?.id) throw new Error('Sandbox not initialized for project')

  const project = await ProjectService.getProjectById(projectId)
  const metadata = project?.metadata as ProjectMetadata | null
  const workDir = metadata?.workingDirectory || workspacePath(projectId)
  const archivePath = `/tmp/${listingId}-snapshot.tar.gz`

  const sandbox = await getProvider().resume(sandboxRow.id)

  const tarCmd = [
    'tar -czf',
    shellQuote(archivePath),
    '--exclude=node_modules',
    '--exclude=.git',
    '--exclude=.next',
    '--exclude=dist',
    '--exclude=.turbo',
    '--exclude=*.log',
    '--exclude=.env*',
    '.',
  ].join(' ')

  const result = await sandbox.exec(tarCmd, { cwd: workDir, timeout: 180_000 })
  if (result.code !== 0) {
    throw new Error(`Failed to create snapshot archive: ${result.output}`)
  }

  let buffer: Buffer
  try {
    buffer = await sandbox.read(archivePath)
  } catch {
    // Fallback to base64 transfer for large files
    const cmd = `base64 -w0 ${shellQuote(archivePath)} 2>/dev/null || base64 ${shellQuote(archivePath)}`
    const res = await sandbox.exec(cmd, { timeout: 120_000 })
    if (res.code !== 0) throw new Error(`Failed to read snapshot: ${res.output}`)
    buffer = Buffer.from((res.output || '').toString().trim(), 'base64')
  }

  // Clean up temp file
  await sandbox.exec(`rm -f ${shellQuote(archivePath)}`).catch(() => {})

  const checksum = createHash('sha256').update(buffer).digest('hex')
  const key = snapshotKey(listingId)

  await storage.upload(key, buffer, 'application/gzip')

  const snapshot = await ProjectService.upsertSnapshot({
    listingId,
    projectId,
    storageKey: key,
    sizeBytes: String(buffer.length),
    checksum,
  })

  log.info(
    { listingId, projectId, snapshotId: snapshot.id, sizeBytes: buffer.length },
    'snapshot created',
  )

  return { snapshotId: snapshot.id, storageKey: key }
}

export async function restoreSnapshot(
  storageKey: string,
  sandbox: { id: string; exec: InstanceType<any>['exec'] },
  workDir: string,
): Promise<void> {
  const result = await storage.download(storageKey)
  if (!result) throw new Error(`Snapshot not found in storage: ${storageKey}`)

  // Collect stream into buffer (handle both Node.js and Web streams)
  const stream = result.body as any
  let buffer: Buffer
  if (typeof stream.transformToByteArray === 'function') {
    buffer = Buffer.from(await stream.transformToByteArray())
  } else if (typeof stream[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    buffer = Buffer.concat(chunks)
  } else {
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    buffer = Buffer.concat(chunks)
  }

  // Write to sandbox via base64 (works across all providers)
  const b64 = buffer.toString('base64')
  const archivePath = `/tmp/restore-snapshot.tar.gz`

  // Split into chunks to avoid shell arg limits
  const chunkSize = 500_000
  for (let i = 0; i < b64.length; i += chunkSize) {
    const chunk = b64.slice(i, i + chunkSize)
    const op = i === 0 ? '>' : '>>'
    const res = await sandbox.exec(`echo '${chunk}' ${op} ${archivePath}.b64`, { timeout: 30_000 })
    if (res.code !== 0) throw new Error(`Failed to write snapshot chunk: ${res.output}`)
  }

  // Decode and extract
  const decode = await sandbox.exec(
    `base64 -d ${archivePath}.b64 > ${archivePath} && mkdir -p ${shellQuote(workDir)} && tar -xzf ${archivePath} -C ${shellQuote(workDir)}`,
    { timeout: 180_000 },
  )
  if (decode.code !== 0) {
    throw new Error(`Failed to restore snapshot: ${decode.output}`)
  }

  // Clean up
  await sandbox.exec(`rm -f ${archivePath} ${archivePath}.b64`).catch(() => {})

  log.info({ storageKey, workDir }, 'snapshot restored')
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await ProjectService.getSnapshotById(snapshotId)
  if (!snapshot) return

  await storage.delete(snapshot.storageKey).catch(() => {})
  await ProjectService.deleteSnapshotById(snapshotId)

  log.info({ snapshotId }, 'snapshot deleted')
}
