import { createLogger } from '@/lib/logger'
import { HttpError } from '@/lib/errors'
import { getProvider, workspacePath } from '@/lib/sandbox'
import { shellQuote } from '@/lib/utils'
import { storage } from '@/lib/storage'
import * as ProjectService from '@/services/projects'
import * as MarketplaceService from '@/services/marketplace'

const log = createLogger('marketplace-snapshot')

export interface CreateSnapshotResult {
  snapshotId: string
  storageKey: string
  sizeBytes: number
  version: number
}

export async function createProjectSnapshot(projectId: string): Promise<CreateSnapshotResult> {
  const project = await ProjectService.getProjectById(projectId)
  if (!project) throw new HttpError(404, 'Project not found')

  const sandboxRow = await ProjectService.getSandboxByProjectId(projectId)
  if (!sandboxRow?.id) throw new HttpError(400, 'Sandbox not initialized')

  if (!storage.isConfigured) throw new HttpError(500, 'Storage not configured')

  const sandbox = await getProvider().resume(sandboxRow.id)
  const metadata = project.metadata as Record<string, unknown> | null
  const workingDir = (metadata?.workingDirectory as string) || workspacePath(projectId)
  const archivePath = `/tmp/${projectId}-snapshot.tar.gz`

  // Same excludes as downloadProject in controllers/projects.ts
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

  try {
    const result = await sandbox.exec(tarCmd, { cwd: workingDir, timeout: 180_000 })
    if (result.code !== 0) {
      throw new HttpError(500, `Failed to create archive: ${result.output}`)
    }

    // Read the tarball from the sandbox
    let buffer: Buffer
    try {
      buffer = await sandbox.read(archivePath)
    } catch {
      // Fallback: base64 extraction for large files
      const b64 = await sandbox.exec(
        `base64 -w0 ${shellQuote(archivePath)} 2>/dev/null || base64 ${shellQuote(archivePath)}`,
        { timeout: 120_000 },
      )
      if (b64.code !== 0) throw new HttpError(500, `Failed to read archive: ${b64.output}`)
      buffer = Buffer.from((b64.output || '').toString().trim(), 'base64')
    }

    // Upload to R2
    const random = Math.random().toString(36).slice(2, 10)
    const storageKey = `snapshots/${projectId}/${Date.now()}-${random}.tar.gz`

    await storage.upload(storageKey, buffer, 'application/gzip')

    // Create DB record
    const snapshot = await MarketplaceService.createSnapshot({
      projectId,
      storageKey,
      sizeBytes: buffer.length,
    })

    log.info(
      { projectId, snapshotId: snapshot.id, version: snapshot.version, sizeBytes: buffer.length },
      'snapshot created',
    )

    return {
      snapshotId: snapshot.id,
      storageKey,
      sizeBytes: buffer.length,
      version: snapshot.version,
    }
  } finally {
    await sandbox.exec(`rm -f ${shellQuote(archivePath)}`).catch(() => {})
  }
}
