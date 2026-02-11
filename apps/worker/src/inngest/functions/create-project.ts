import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { config } from '@/lib/config'
import { getProvider, workspacePath, defaultProviderName } from '@/lib/sandbox'
import * as ProjectService from '@/services/projects'
import path from 'path'
import stripJsonComments from 'strip-json-comments'

const posix = path.posix
const PREVIEW_PORT = 3000

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

function buildBashCommand(cwd: string, script: string): string {
  return `bash -lc '${['set -euo pipefail', `cd ${shellQuote(cwd)}`, script].join('\n').replace(/'/g, "'\"'\"'")}'`
}

function validateProcessName(name: string): void {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(name)) {
    throw new Error('Invalid process name: must match ^[a-zA-Z0-9._-]{1,64}$')
  }
}

function validateDevScript(command: string): void {
  const safe = /^(bun(x)?|npm|pnpm|yarn)\s+(run\s+)?[a-zA-Z0-9_:.-]+(\s+--[a-zA-Z0-9_=-]*)*$/
  if (!safe.test(command.trim())) {
    throw new Error('Invalid dev script: only package manager run commands allowed')
  }
}

async function getProjectEnvVars(projectId: string, environment: string) {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, environment)
  return Object.fromEntries(
    rows
      .filter((row) => row.value && row.destination !== 'server')
      .map((row) => [row.key, row.value as string]),
  )
}

async function getProjectApiKey(projectId: string): Promise<string> {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, 'development')
  const row = rows.find((r) => r.key === 'SURGENT_API_KEY' && r.value)
  if (!row?.value) throw new Error('SURGENT_API_KEY not found for project')
  return row.value
}

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------

type CreateProjectEvent = {
  name: 'project/create.requested'
  data: {
    projectId: string
    userId: string
    organizationId: string
    githubUrl: string
    name: string
  }
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const createProjectFn = inngest.createFunction(
  {
    id: 'create-project',
    retries: 1,
    onFailure: async ({ event }) => {
      const { projectId } = event.data.event.data as CreateProjectEvent['data']
      const errorMessage = event.data.error?.message || 'Project creation failed after retries'

      // Mark project as failed
      await ProjectService.updateProjectStatus(projectId, 'failed', errorMessage).catch(() => {})

      console.error('[inngest:onFailure] project creation failed', { projectId, errorMessage })
    },
  },
  { event: 'project/create.requested' },
  async ({ event, step }) => {
    const { projectId, userId, organizationId, githubUrl, name } =
      event.data as CreateProjectEvent['data']
    const workingDirectory = workspacePath(projectId)
    const apiKey = await getProjectApiKey(projectId)

    // -----------------------------------------------------------------------
    // Step 1: Provision sandbox
    // -----------------------------------------------------------------------
    const sandboxResult = await step.run('provision-sandbox', async () => {
      await ProjectService.updateProvisioningStep(projectId, 'Provisioning sandbox')
      if (!config.surgent.baseUrl || !config.opencode.baseUrl) {
        throw new NonRetriableError('SURGENT_BASE_URL and OPENCODE_BASE_URL are not set')
      }

      const devEnv = await getProjectEnvVars(projectId, 'development')
      const opencodeEnv = {
        ...devEnv,
        SURGENT_API_KEY: apiKey,
        SURGENT_BASE_URL: config.surgent.baseUrl,
        OPENCODE_API_KEY: apiKey,
        OPENCODE_BASE_URL: config.opencode.baseUrl,
        OPENCODE_CONFIG_DIR: config.opencode.configDir,
      }

      const provider = getProvider()
      const sandbox = await provider.create(opencodeEnv, 'server')
      const previewUrl = await sandbox.host(PREVIEW_PORT)

      console.log('[inngest] sandbox created:', sandbox.id, 'provider:', defaultProviderName)

      return { sandboxId: sandbox.id, previewUrl }
    })

    // -----------------------------------------------------------------------
    // Step 2: Clone repo + run init + start dev server
    // -----------------------------------------------------------------------
    const initResult = await step.run('initialize-project', async () => {
      await ProjectService.updateProvisioningStep(projectId, 'Installing dependencies')
      const sandbox = await getProvider().resume(sandboxResult.sandboxId)
      let processName = `${projectId}-vite-server`
      let devScript: string | undefined
      let initScript: string | undefined

      // Clone repo
      if (githubUrl) {
        console.log('[inngest] cloning template...')
        await sandbox.clone(githubUrl, workingDirectory)
        const reset = await sandbox.exec(
          buildBashCommand(workingDirectory, 'rm -rf .git && git init -b main'),
          { timeout: 60_000 },
        )
        if (reset.code !== 0) {
          throw new Error(`Failed to reset git after clone: ${reset.output}`)
        }
      }

      // Read surgent.json
      try {
        const content = (await sandbox.read(`${workingDirectory}/surgent.json`)).toString('utf8')
        const cfg = JSON.parse(stripJsonComments(content))
        initScript = cfg?.scripts?.init
        devScript = cfg?.scripts?.dev
        if (cfg?.name?.trim()) processName = cfg.name.trim()
        console.log('[inngest] config:', { initScript, devScript, processName })
      } catch {
        console.log('[inngest] no surgent.json or parse error')
      }

      // Run init script
      if (initScript) {
        const init = await sandbox.exec(buildBashCommand(workingDirectory, initScript), {
          timeout: 600_000,
        })
        if (init.code !== 0) {
          throw new Error(`Init script failed (exit ${init.code}): ${init.output}`)
        }
      }

      // Start dev server
      if (devScript) {
        validateProcessName(processName)
        validateDevScript(devScript)
        const devEnv = await getProjectEnvVars(projectId, 'development')
        const quotedName = shellQuote(processName)
        const quotedCommand = shellQuote(devScript)
        const pm2Dev = await sandbox.exec(
          `pm2 delete ${quotedName} 2>/dev/null; pm2 start ${quotedCommand} --name ${quotedName}`,
          { timeout: 300_000, cwd: workingDirectory, env: devEnv },
        )
        if (pm2Dev.code !== 0) {
          throw new Error(`Failed to start dev server (exit ${pm2Dev.code}): ${pm2Dev.output}`)
        }
      }

      return { processName, startCommand: devScript }
    })

    // -----------------------------------------------------------------------
    // Step 3: Setup OpenCode
    // -----------------------------------------------------------------------
    await step.run('setup-opencode', async () => {
      await ProjectService.updateProvisioningStep(projectId, 'Starting AI agent')
      const sandbox = await getProvider().resume(sandboxResult.sandboxId)
      const opencodeConfigDir = config.opencode.configDir
      const repoUrl = config.opencode.configRepoUrl

      // Clone or update config repo
      const repoDir = opencodeConfigDir.replace(/\/$/, '')
      try {
        const stat = await sandbox.stat(repoDir)
        if (stat.isDir) {
          const pull = await sandbox.exec(`git -C ${shellQuote(repoDir)} pull --ff-only`, {
            timeout: 120_000,
          })
          if (pull.code !== 0) throw new Error(`Failed to update opencode config: ${pull.output}`)
        }
      } catch {
        await sandbox.exec(`mkdir -p ${shellQuote(posix.dirname(repoDir))}`, { timeout: 60_000 })
        const clone = await sandbox.exec(
          `git clone --depth 1 ${shellQuote(repoUrl)} ${shellQuote(repoDir)}`,
          { timeout: 120_000 },
        )
        if (clone.code !== 0) throw new Error(`Failed to clone opencode config: ${clone.output}`)
      }

      // Start opencode server
      const devEnv = await getProjectEnvVars(projectId, 'development')
      const opencodeEnv = {
        ...devEnv,
        SURGENT_API_KEY: apiKey,
        SURGENT_BASE_URL: config.surgent.baseUrl!,
        OPENCODE_API_KEY: apiKey,
        OPENCODE_BASE_URL: config.opencode.baseUrl!,
        OPENCODE_CONFIG_DIR: opencodeConfigDir,
      }
      const pm2Opencode = await sandbox.exec(
        `pm2 delete 'opencode-server' 2>/dev/null; pm2 start 'opencode serve --hostname 0.0.0.0 --port 4096' --name 'opencode-server'`,
        { timeout: 300_000, cwd: workingDirectory, env: opencodeEnv },
      )
      if (pm2Opencode.code !== 0) {
        throw new Error(
          `Failed to start opencode server (exit ${pm2Opencode.code}): ${pm2Opencode.output}`,
        )
      }
      console.log('[inngest] opencode server started')
    })

    // -----------------------------------------------------------------------
    // Step 4: Finalize — update DB records + mark ready
    // -----------------------------------------------------------------------
    await step.run('finalize', async () => {
      await ProjectService.updateProvisioningStep(projectId, 'Finalizing')
      await ProjectService.updateProject(projectId, {
        metadata: {
          workingDirectory,
          processName: initResult.processName,
          startCommand: initResult.startCommand,
        },
      })
      await ProjectService.upsertSandbox({
        id: sandboxResult.sandboxId,
        projectId,
        provider: defaultProviderName,
        status: 'started',
        host: sandboxResult.previewUrl,
      })
      await ProjectService.updateProjectStatus(projectId, 'ready')

      console.log('[inngest] project ready', { projectId })
    })

    return { projectId, sandboxId: sandboxResult.sandboxId, previewUrl: sandboxResult.previewUrl }
  },
)
