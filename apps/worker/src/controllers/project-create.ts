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
import { buildBashCommand } from '@/lib/utils'
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
  let provisioning = getProvisioning(metadata)

  if (!provisioning.sandboxId) {
    await setProvisioningStep(projectId, 'provisioning_sandbox')
    const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
    const sandbox = await getProvider().create(buildOpencodeEnv(devEnv, apiKey), 'server')
    const previewUrl = await sandbox.host(PREVIEW_PORT)

    log.info(
      { projectId, sandboxId: sandbox.id, provider: defaultProviderName },
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
    const sandbox = await getProvider().resume(provisioning.sandboxId)
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
    const sandbox = await getProvider().resume(sandboxId)
    let processName = provisioning.processName || `${projectId}-vite-server`
    let startCommand = provisioning.startCommand
    let initScript: string | undefined

    if (githubUrl && !provisioning.clonedAt) {
      log.info({ projectId, githubUrl }, 'project create template clone started')
      await sandbox.clone(githubUrl, workingDirectory)
      const reset = await sandbox.exec(
        buildBashCommand(workingDirectory, 'rm -rf .git && git init -b main'),
        { timeout: 60_000 },
      )
      if (reset.code !== 0) {
        throw new Error(`Failed to reset git after clone: ${reset.output}`)
      }
      const next = await ProjectService.mergeProjectMetadata(projectId, {
        workingDirectory,
        provisioning: { clonedAt: new Date().toISOString() },
      })
      provisioning = getProvisioning(next)
    }

    try {
      const content = (await sandbox.read(`${workingDirectory}/surgent.json`)).toString('utf8')
      const cfg = JSON.parse(stripJsonComments(content))
      initScript = cfg?.scripts?.init
      startCommand = cfg?.scripts?.dev
      if (cfg?.name?.trim()) processName = cfg.name.trim()
      log.info({ projectId, initScript, startCommand, processName }, 'project create config loaded')
    } catch {
      log.debug({ projectId }, 'project create config missing or invalid')
    }

    if (initScript) {
      const init = await sandbox.exec(buildBashCommand(workingDirectory, initScript), {
        timeout: 600_000,
      })
      if (init.code !== 0) {
        throw new Error(`Init script failed (exit ${init.code}): ${init.output}`)
      }
    }

    if (startCommand) {
      const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
      await ensurePm2Process(sandbox, workingDirectory, processName, startCommand, devEnv)
    }

    const next = await ProjectService.mergeProjectMetadata(projectId, {
      workingDirectory,
      provisioning: {
        processName,
        startCommand,
        initializedAt: new Date().toISOString(),
      },
    })
    provisioning = getProvisioning(next)
  }

  if (!provisioning.opencodeReadyAt) {
    await setProvisioningStep(projectId, 'starting_ai_agent')
    const sandbox = await getProvider().resume(sandboxId)
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

  const processName = provisioning.processName || `${name || projectId}-vite-server`

  await ProjectService.mergeProjectMetadata(projectId, {
    workingDirectory,
    processName,
    startCommand: provisioning.startCommand,
    provisioningStep: null,
    provisioning: {
      finalizedAt: new Date().toISOString(),
      lastError: null,
    },
  })

  await ProjectService.upsertSandbox({
    id: sandboxId,
    projectId,
    provider: defaultProviderName,
    status: 'started',
    host: previewUrl,
  })
  await ProjectService.updateProjectStatus(projectId, 'ready')

  log.info({ projectId }, 'project create completed')
}
