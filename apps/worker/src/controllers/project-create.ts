import {
  getProjectProvisioningStepLabel,
  type ProjectMetadata,
  type ProjectProvisioningMetadata,
  type ProjectProvisioningStep,
} from '@repo/db'
import path from 'path'
import stripJsonComments from 'strip-json-comments'
import { config } from '@/lib/config'
import { createLogger } from '@/lib/logger'
import { getProvider, workspacePath, defaultProviderName } from '@/lib/sandbox'
import { buildBashCommand, shellQuote } from '@/lib/utils'
import * as ProjectService from '@/services/projects'
import {
  ensureOpencodeConfigRepo,
  ensurePm2Process,
  getProjectEnvVars,
  startOpencodeServer,
} from '@/controllers/projects'

const log = createLogger('project-create')

const posix = path.posix
const PREVIEW_PORT = 3000

export interface CreateProjectJobData {
  projectId: string
  userId: string
  organizationId: string
  githubUrl: string
  name: string
}

async function getProjectApiKey(projectId: string): Promise<string> {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, 'development')
  const row = rows.find((it) => it.key === 'SURGENT_API_KEY' && it.value)
  if (!row?.value) throw new Error('SURGENT_API_KEY not found for project')
  return row.value
}

function getProvisioning(
  metadata: ProjectMetadata | null | undefined,
): ProjectProvisioningMetadata {
  return metadata?.provisioning || {}
}

function buildOpencodeEnv(devEnv: Record<string, string>, apiKey: string) {
  return {
    ...devEnv,
    SURGENT_API_KEY: apiKey,
    SURGENT_BASE_URL: config.surgent.baseUrl!,
    OPENCODE_API_KEY: apiKey,
    OPENCODE_BASE_URL: config.opencode.baseUrl!,
    OPENCODE_CONFIG_DIR: config.opencode.configDir,
  }
}

function repoLabel(repoUrl: string): string {
  const url = new URL(repoUrl)
  return `${url.hostname}${url.pathname.replace(/\.git$/, '')}`
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /ENOENT|not found|no such file/i.test(error.message)
}

async function setProvisioningStep(projectId: string, step: ProjectProvisioningStep) {
  await ProjectService.updateProvisioningStep(projectId, step)
  log.info(
    { projectId, provisioningStep: step, provisioningLabel: getProjectProvisioningStepLabel(step) },
    'project create state changed',
  )
}

export async function runProjectCreationJob(data: CreateProjectJobData): Promise<void> {
  const { projectId, githubUrl, name } = data
  const project = await ProjectService.getProjectById(projectId)
  if (!project) throw new Error(`Project ${projectId} not found`)
  if (project.status === 'ready') return

  if (!config.surgent.baseUrl || !config.opencode.baseUrl) {
    await ProjectService.updateProjectStatus(
      projectId,
      'failed',
      'SURGENT_BASE_URL and OPENCODE_BASE_URL are not set',
    )
    return
  }

  const metadata = project.metadata
  const workingDirectory = metadata?.workingDirectory || workspacePath(projectId)
  const apiKey = await getProjectApiKey(projectId)
  const providerName = defaultProviderName
  const provider = getProvider(providerName)
  let provisioning = getProvisioning(metadata)
  let processName = metadata?.processName || `${projectId}-vite-server`
  let startCommand = metadata?.startCommand

  if (!provisioning.sandboxId) {
    await setProvisioningStep(projectId, 'provisioning_sandbox')
    const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
    const sandbox = await provider.create(buildOpencodeEnv(devEnv, apiKey), 'server')
    const previewUrl = await sandbox.host(PREVIEW_PORT)

    log.info(
      { projectId, sandboxId: sandbox.id, provider: providerName },
      'project create sandbox provisioned',
    )

    const next = await ProjectService.mergeProjectMetadata(projectId, {
      workingDirectory,
      provisioning: {
        sandboxId: sandbox.id,
        previewUrl,
      },
    })
    provisioning = getProvisioning(next)
  }

  if (!provisioning.previewUrl && provisioning.sandboxId) {
    const sandbox = await provider.resume(provisioning.sandboxId)
    const previewUrl = await sandbox.host(PREVIEW_PORT)
    const next = await ProjectService.mergeProjectMetadata(projectId, {
      workingDirectory,
      provisioning: { previewUrl },
    })
    provisioning = getProvisioning(next)
  }

  if (!provisioning.sandboxId || !provisioning.previewUrl) {
    throw new Error('Project provisioning is missing sandbox state')
  }

  const sandboxId = provisioning.sandboxId
  const previewUrl = provisioning.previewUrl

  if (!provisioning.initializedAt) {
    await setProvisioningStep(projectId, 'installing_dependencies')
    let initScript: string | undefined

    try {
      const sandbox = await provider.resume(sandboxId)

      if (githubUrl) {
        log.info(
          { projectId, template: repoLabel(githubUrl) },
          'project create template clone started',
        )
        const clean = await sandbox.exec(`rm -rf ${shellQuote(workingDirectory)}`, {
          timeout: 60_000,
        })
        if (clean.code !== 0) {
          throw new Error(`Failed to clean project workspace before clone (exit ${clean.code})`)
        }
        await sandbox.clone(githubUrl, workingDirectory)
        const reset = await sandbox.exec(
          buildBashCommand(workingDirectory, 'rm -rf .git && git init -b main'),
          { timeout: 60_000 },
        )
        if (reset.code !== 0) {
          throw new Error(`Failed to reset git after clone (exit ${reset.code})`)
        }
      }

      let configContent: string | null = null
      try {
        configContent = (await sandbox.read(`${workingDirectory}/surgent.json`)).toString('utf8')
      } catch (error) {
        if (!isMissingFileError(error)) throw error
        log.debug({ projectId }, 'project create config missing')
      }

      if (configContent) {
        let cfg: { scripts?: { init?: string; dev?: string }; name?: string }
        try {
          cfg = JSON.parse(stripJsonComments(configContent))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid JSON'
          throw new Error(`Invalid surgent.json: ${message}`)
        }

        initScript = cfg?.scripts?.init
        startCommand = cfg?.scripts?.dev
        if (cfg?.name?.trim()) processName = cfg.name.trim()
        log.info(
          { projectId, initScript, startCommand, processName },
          'project create config loaded',
        )
      }

      if (initScript) {
        const init = await sandbox.exec(buildBashCommand(workingDirectory, initScript), {
          timeout: 600_000,
        })
        if (init.code !== 0) {
          throw new Error(`Init script failed (exit ${init.code})`)
        }
      }

      if (startCommand) {
        const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
        await ensurePm2Process(sandbox, workingDirectory, processName, startCommand, devEnv)
      }

      const next = await ProjectService.mergeProjectMetadata(projectId, {
        workingDirectory,
        processName,
        startCommand,
        provisioning: { initializedAt: new Date().toISOString() },
      })
      provisioning = getProvisioning(next)
    } catch (err) {
      log.warn(
        { projectId, sandboxId, err },
        'project create initialization failed, resetting sandbox',
      )
      try {
        await provider.kill(sandboxId)
      } catch (killErr) {
        log.warn({ projectId, sandboxId, err: killErr }, 'project create sandbox cleanup failed')
      }

      await ProjectService.mergeProjectMetadata(projectId, {
        workingDirectory,
        provisioning: {
          sandboxId: undefined,
          previewUrl: undefined,
        },
      })

      throw err
    }
  }

  if (!provisioning.opencodeReadyAt) {
    await setProvisioningStep(projectId, 'starting_ai_agent')
    const sandbox = await provider.resume(sandboxId)
    const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
    await ensureOpencodeConfigRepo(
      sandbox,
      config.opencode.configRepoUrl,
      config.opencode.configDir,
    )
    await startOpencodeServer(sandbox, workingDirectory, buildOpencodeEnv(devEnv, apiKey))

    const next = await ProjectService.mergeProjectMetadata(projectId, {
      workingDirectory,
      provisioning: {
        opencodeReadyAt: new Date().toISOString(),
      },
    })
    provisioning = getProvisioning(next)
  }

  if (provisioning.finalizedAt) return

  await setProvisioningStep(projectId, 'finalizing')

  await ProjectService.mergeProjectMetadata(projectId, {
    workingDirectory,
    processName,
    startCommand,
    provisioningStep: null,
    provisioning: {
      finalizedAt: new Date().toISOString(),
      lastError: null,
    },
  })

  await ProjectService.upsertSandbox({
    id: sandboxId,
    projectId,
    provider: providerName,
    status: 'started',
    host: previewUrl,
  })
  await ProjectService.updateProjectStatus(projectId, 'ready')

  log.info({ projectId }, 'project create completed')
}
