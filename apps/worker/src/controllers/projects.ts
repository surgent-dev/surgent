import type { Sandbox } from '@/apis/sandbox'
import type { ProjectMetadata } from '@repo/db'
import { config } from '@/lib/config'
import { db } from '@/lib/db'
import { HttpError } from '@/lib/errors'
import { getProvider, resumeSandbox, workspacePath, defaultProviderName } from '@/lib/sandbox'
import { sanitizeHostname } from '@/lib/utils'
import { createHash } from 'crypto'
import { parse as parseDotEnv } from 'dotenv'
import path from 'path'
import stripJsonComments from 'strip-json-comments'
import * as ProjectService from '@/services/projects'
import { createDeployment, createDeployKey } from '@/apis/convex'
import {
  buildDeploymentConfig,
  parseWranglerConfig,
  deployToDispatch,
} from '@/apis/deployer/deploy'
import { auth } from '@/lib/auth'
import { WorkerDeployer } from '@/apis/deployer/deployer'
import Cloudflare from 'cloudflare'

// ============================================================================
// Constants
// ============================================================================

const MAX_PROJECTS_PER_ORG = 2
const PREVIEW_PORT = 3000

const DEFAULT_WORKER = `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};`

const DEFAULT_WRANGLER = {
  compatibility_date: '2025-04-24',
  assets: { binding: 'ASSETS', not_found_handling: 'single-page-application' as const },
  observability: { enabled: true, head_sampling_rate: 0.1 },
}

// ============================================================================
// Types
// ============================================================================

export interface InitializeProjectArgs {
  githubUrl: string
  userId: string
  organizationId: string
  name?: string
  initConvex?: boolean
  headers?: Headers
}

export interface ResumeProjectArgs {
  projectId: string
  sandboxId: string
}

export interface RunAgentArgs {
  sandboxId: string
  projectId: string
  prompt: string
  sessionId?: string
  convexSessionId: string
  model?: string
  mode?: 'build' | 'plan'
}

export interface DeployProjectArgs {
  projectId: string
  deployName?: string
  deploymentId: string
}

type ConvexConfig = {
  convexProjectId?: string
  deploymentName?: string
  deploymentUrl?: string
  deployments?: {
    development?: { name?: string; url?: string }
    production?: { name?: string; url?: string }
  }
}

export interface UndeployProjectArgs {
  projectId: string
}

export interface DeleteProjectArgs {
  projectId: string
}

export interface DownloadProjectArgs {
  projectId: string
}

export interface GetSandboxLogsArgs {
  projectId: string
  lines?: number
}

export interface RedeployVersionArgs {
  projectId: string
  versionId: string
}

// ============================================================================
// Helpers
// ============================================================================

const posix = path.posix

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

function buildBashCommand(cwd: string, script: string): string {
  return `bash -lc '${['set -euo pipefail', `cd ${shellQuote(cwd)}`, script].join('\n').replace(/'/g, "'\"'\"'")}'`
}

function stripTrailingSlash(s: string): string {
  return s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s
}

function resolveEntryPath(currentDir: string, entry: unknown): string {
  const info = entry as Record<string, any>
  if (typeof info.path === 'string' && info.path) return info.path
  const name = typeof info.name === 'string' ? info.name : ''
  return name ? posix.join(stripTrailingSlash(currentDir), name) : currentDir
}

function sanitizeScriptName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

function validateProcessName(name: string): void {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(name)) {
    throw new Error(`Invalid process name: must match ^[a-zA-Z0-9._-]{1,64}$`)
  }
}

function validateDevScript(command: string): void {
  // Allow: bun run <script>, npm run <script>, pnpm run <script>, yarn <script>, bunx <cmd>
  const safe = /^(bun(x)?|npm|pnpm|yarn)\s+(run\s+)?[a-zA-Z0-9_:.-]+(\s+--[a-zA-Z0-9_=-]*)*$/
  if (!safe.test(command.trim())) {
    throw new Error(`Invalid dev script: only package manager run commands allowed`)
  }
}

async function getProjectEnvVars(
  projectId: string,
  environment: string,
  options?: { includeServer?: boolean },
) {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, environment)
  const includeServer = options?.includeServer ?? true
  return Object.fromEntries(
    rows
      .filter((row) => row.value && (includeServer || row.destination !== 'server'))
      .map((row) => [row.key, row.value as string]),
  )
}

async function directoryExists(sandbox: Sandbox, dir: string): Promise<boolean> {
  try {
    return (await sandbox.stat(dir)).isDir
  } catch {
    return false
  }
}

async function downloadFileSafe(sandbox: Sandbox, filePath: string, cwd?: string): Promise<Buffer> {
  try {
    return await sandbox.read(filePath)
  } catch {
    const cmd = `base64 -w0 ${shellQuote(filePath)} 2>/dev/null || base64 ${shellQuote(filePath)}`
    const res = await sandbox.exec(cmd, { timeout: 60_000, cwd })
    if (res.code !== 0) throw new Error(`downloadFileSafe failed: ${res.output}`)
    return Buffer.from((res.output || '').toString().trim(), 'base64')
  }
}

async function collectAssets(sandbox: Sandbox, rootDir: string, hashSalt: string) {
  const root = stripTrailingSlash(rootDir)
  const manifest: Record<string, { hash: string; size: number }> = {}
  const files: Array<{ path: string; base64: string }> = []

  async function walk(dir: string) {
    for (const entry of await sandbox.list(dir)) {
      const entryPath = resolveEntryPath(dir, entry)
      if (entry.isDir) {
        await walk(entryPath)
      } else {
        const buffer = await downloadFileSafe(sandbox, entryPath)
        const rel = `/${posix.relative(root, entryPath)}`
        manifest[rel] = {
          hash: createHash('sha256').update(hashSalt).update(buffer).digest('hex').slice(0, 32),
          size: buffer.length,
        }
        files.push({ path: rel, base64: buffer.toString('base64') })
      }
    }
  }

  await walk(rootDir)
  return { manifest, files }
}

async function ensureOpencodeConfigRepo(sandbox: Sandbox, repoUrl: string, dir: string) {
  const repoDir = stripTrailingSlash(dir)
  if (!repoUrl) throw new Error('OPENCODE_CONFIG_REPO_URL is not set')

  if (await directoryExists(sandbox, repoDir)) {
    const gitDir = posix.join(repoDir, '.git')
    if (!(await directoryExists(sandbox, gitDir))) {
      throw new Error(`OPENCODE_CONFIG_DIR exists but is not a git repo: ${repoDir}`)
    }

    const pull = await sandbox.exec(`git -C ${shellQuote(repoDir)} pull --ff-only`, {
      timeout: 120_000,
    })
    if (pull.code !== 0) throw new Error(`Failed to update opencode config repo: ${pull.output}`)
    return
  }

  await sandbox.exec(`mkdir -p ${shellQuote(posix.dirname(repoDir))}`, { timeout: 60_000 })
  const clone = await sandbox.exec(
    `git clone --depth 1 ${shellQuote(repoUrl)} ${shellQuote(repoDir)}`,
    {
      timeout: 120_000,
    },
  )
  if (clone.code !== 0) throw new Error(`Failed to clone opencode config repo: ${clone.output}`)
}

async function execPm2Start(
  sandbox: Sandbox,
  cwd: string,
  name: string,
  command: string,
  env?: Record<string, string>,
) {
  const quotedName = shellQuote(name)
  const quotedCommand = shellQuote(command)
  await sandbox.exec(
    `pm2 delete ${quotedName} 2>/dev/null; pm2 start ${quotedCommand} --name ${quotedName}`,
    {
      timeout: 300_000,
      cwd,
      env,
    },
  )
}

async function ensurePm2Process(
  sandbox: Sandbox,
  cwd: string,
  name: string,
  command: string,
  env?: Record<string, string>,
) {
  validateProcessName(name)
  validateDevScript(command)
  await execPm2Start(sandbox, cwd, name, command, env)
}

async function startOpencodeServer(sandbox: Sandbox, cwd: string, env?: Record<string, string>) {
  console.log('[opencode] starting server...', { sandboxId: sandbox.id, cwd })
  // Trusted internal command - bypass validation
  await execPm2Start(
    sandbox,
    cwd,
    'opencode-server',
    'opencode serve --hostname 0.0.0.0 --port 4096',
    env,
  )
  console.log('[opencode] server started on port 4096')
}

async function getOrCreateSandbox(opts: {
  port: number
  workingDirectory: string
  sandboxId?: string
  env?: Record<string, string>
  name?: string
}) {
  const provider = getProvider()
  let sandbox: Sandbox

  if (opts.sandboxId) {
    try {
      sandbox = await provider.resume(opts.sandboxId)
    } catch {
      sandbox = await provider.create(opts.env, opts.name)
    }
  } else {
    sandbox = await provider.create(opts.env, opts.name)
  }

  return { sandbox, previewUrl: await sandbox.host(opts.port) }
}

// ============================================================================
// Main Functions
// ============================================================================

export async function createDeploymentRecord(projectId: string, deployName?: string) {
  const scriptName = deployName ? sanitizeHostname(deployName) : `project-${projectId.slice(0, 8)}`
  const hostname = `https://${scriptName}.${config.cloudflare.deployDomain}`
  return ProjectService.createDeployment({
    projectId,
    scriptName,
    status: 'queued',
    startedAt: new Date(),
    hostname,
  })
}

export async function deployProject(args: DeployProjectArgs): Promise<void> {
  const { projectId, deployName: rawName, deploymentId } = args
  console.log('[deploy] start', { projectId, deploymentId })

  const project = await ProjectService.getProjectById(projectId)
  if (!project) throw new Error(`Project ${projectId} not found`)
  const sandboxRow = await ProjectService.getSandboxByProjectId(projectId)
  if (!sandboxRow?.id) throw new Error('Sandbox not initialized')

  const scriptName = rawName ? sanitizeHostname(rawName) : `project-${projectId.slice(0, 8)}`
  const workingDir = workspacePath(projectId)
  const accountId = config.cloudflare.accountId!

  const prevName = (await ProjectService.getWorkerByProjectId(projectId))?.scriptName

  const updateStatus = async (status: string, extra?: { error?: string; finishedAt?: Date }) => {
    await ProjectService.updateDeployment(deploymentId, { status, ...extra })
  }

  await updateStatus('starting')

  try {
    const convex = await ProjectService.getIntegrationByProvider(projectId, 'convex')
    const envVars = await (async () => {
      const base = await getProjectEnvVars(projectId, 'production')
      if (!convex?.id) return base

      const cfg = (convex.config ?? {}) as ConvexConfig
      const convexId = cfg.convexProjectId
      if (!convexId) return base // no project ID means incomplete integration, skip

      const prod = cfg.deployments?.production
      if (prod?.name) return base // already provisioned

      const required = ['CONVEX_URL', 'CONVEX_DEPLOY_KEY', 'VITE_CONVEX_URL', 'CONVEX_DEPLOYMENT']
      const missing = required.filter((key) => !base[key])
      if (!missing.length) return base

      // Create prod deployment
      const created = await createDeployment({ projectId: convexId, type: 'prod' })
      const key = await createDeployKey(created.name)

      const vars = {
        CONVEX_DEPLOYMENT: `prod:${created.name}`,
        CONVEX_URL: created.deploymentUrl,
        CONVEX_DEPLOY_KEY: key,
        VITE_CONVEX_URL: created.deploymentUrl,
      }
      await ProjectService.upsertEnvVars(projectId, 'production', vars, convex.id)

      // Update config with prod deployment info
      const dev =
        cfg.deployments?.development ??
        (cfg.deploymentName ? { name: cfg.deploymentName, url: cfg.deploymentUrl } : undefined)
      const nextConfig: ConvexConfig = {
        ...cfg,
        deployments: {
          ...(dev ? { development: dev } : {}),
          production: { name: created.name, url: created.deploymentUrl },
        },
      }
      await ProjectService.updateIntegrationConfig(convex.id, nextConfig)

      return getProjectEnvVars(projectId, 'production')
    })()

    const sandbox = await getProvider().resume(sandboxRow.id)

    await updateStatus('building')
    const build = await sandbox.exec('bun run build', { cwd: workingDir, timeout: 180_000 })
    if (build.code !== 0) {
      const error = `Build failed: ${String(build.output).slice(0, 500)}`
      await updateStatus('build_failed', { error, finishedAt: new Date() })
      throw new Error(error)
    }

    const assetsDir = await findAssetsDir(sandbox, workingDir)
    if (!assetsDir) throw new Error('No dist/ directory found after build')

    const { manifest, files } = await collectAssets(sandbox, assetsDir, scriptName)
    const assetPaths = Object.keys(manifest)
    if (!assetPaths.length) throw new Error('No assets found in dist/')

    const localEnv = await readEnvFile(sandbox, `${workingDir}/.env`)

    await updateStatus('uploading')

    const wranglerConfig = { name: scriptName, ...DEFAULT_WRANGLER }
    const wrangler = parseWranglerConfig(JSON.stringify(wranglerConfig))
    const deployConfig = buildDeploymentConfig(wrangler, DEFAULT_WORKER, accountId, manifest)

    if (localEnv) deployConfig.vars = { ...localEnv, ...deployConfig.vars }
    if (Object.keys(envVars).length) deployConfig.vars = { ...deployConfig.vars, ...envVars }

    const assetPreview = assetPaths.slice(0, 12)
    const assetMore = assetPaths.length - assetPreview.length
    const envKeys = Object.keys(deployConfig.vars || {}).sort()
    const envPreview = envKeys.slice(0, 20)
    const envMore = envKeys.length - envPreview.length
    const localKeys = Object.keys(localEnv || {})
    const projectKeys = Object.keys(envVars)

    console.log('[deploy] plan', {
      projectId,
      deploymentId,
      scriptName,
      assets: {
        dir: assetsDir,
        count: assetPaths.length,
        files: files.length,
        paths: assetPreview,
        ...(assetMore ? { more: assetMore } : {}),
      },
      env: {
        count: envKeys.length,
        keys: envPreview,
        ...(envMore ? { more: envMore } : {}),
        sources: { local: localKeys.length, project: projectKeys.length },
      },
    })

    const fileContents = new Map(files.map((f) => [f.path, Buffer.from(f.base64, 'base64')]))
    await deployToDispatch(
      { ...deployConfig, dispatchNamespace: config.cloudflare.dispatchNamespace! },
      fileContents,
      wranglerConfig.assets,
    )

    // Fetch Cloudflare deployment info for version tracking
    const cfDeployment = await fetchLatestCloudflareDeployment(accountId, scriptName)
    const finishedAt = new Date()
    const workerHostname = `https://${scriptName}.${config.cloudflare.deployDomain}`

    await ProjectService.updateDeployment(deploymentId, {
      status: 'deployed',
      finishedAt,
      cloudflareDeploymentId: cfDeployment?.id ?? null,
      cloudflareVersionId: cfDeployment?.versionId ?? null,
    })

    await ProjectService.upsertWorker({
      projectId,
      accountId,
      scriptName,
      dispatchNamespace: config.cloudflare.dispatchNamespace,
      hostname: workerHostname,
      status: 'active',
    })

    if (prevName && prevName !== scriptName) {
      await new WorkerDeployer()
        .deleteWorker(prevName, config.cloudflare.dispatchNamespace!)
        .catch(() => {})
    }

    console.log('[deploy] success', { projectId, scriptName, cfDeploymentId: cfDeployment?.id })
  } catch (err: any) {
    console.error('[deploy] failed', { projectId, error: err?.message })
    await ProjectService.updateDeployment(deploymentId, {
      status: 'deploy_failed',
      error: err?.message || 'Deployment failed',
      finishedAt: new Date(),
    }).catch(() => {})
    // Don't update worker status on deploy failure - previous version may still be running
    throw err
  }
}

async function fetchLatestCloudflareDeployment(accountId: string, scriptName: string) {
  try {
    if (config.cloudflare.dispatchNamespace) return null
    const client = new Cloudflare({ apiToken: config.cloudflare.apiToken })
    const result: any = await client.workers.scripts.deployments.list(scriptName, {
      account_id: accountId,
    })
    const deployments = Array.isArray(result) ? result : result.result || []
    const latest = deployments[0]
    if (!latest) return null
    return { id: latest.id, versionId: latest.versions?.[0]?.version_id }
  } catch {
    return null
  }
}

export async function undeployProject(args: UndeployProjectArgs): Promise<void> {
  const { projectId } = args
  console.log('[undeploy] start', { projectId })

  const project = await ProjectService.getProjectById(projectId)
  if (!project) throw new Error(`Project ${projectId} not found`)

  const worker = await ProjectService.getWorkerByProjectId(projectId)
  const latestScriptName = await ProjectService.getLatestDeploymentScriptName(projectId)
  const scriptName = worker?.scriptName || latestScriptName
  if (!scriptName) throw new Error('No deployment name found')

  const deployment = await ProjectService.createDeployment({
    projectId,
    scriptName,
    status: 'undeploying',
    startedAt: new Date(),
  })

  try {
    const deployer = new WorkerDeployer()
    await deployer.deleteWorker(scriptName, config.cloudflare.dispatchNamespace!)

    await ProjectService.updateDeployment(deployment.id, {
      status: 'undeployed',
      finishedAt: new Date(),
    })
    await ProjectService.upsertWorker({
      projectId,
      accountId: config.cloudflare.accountId!,
      scriptName,
      dispatchNamespace: config.cloudflare.dispatchNamespace,
      hostname: null,
      status: null,
    })

    console.log('[undeploy] success', { projectId, scriptName })
  } catch (err: any) {
    console.error('[undeploy] failed', { projectId, error: err?.message })
    await ProjectService.updateDeployment(deployment.id, {
      status: 'undeploy_failed',
      error: err?.message || 'Undeploy failed',
      finishedAt: new Date(),
    }).catch(() => {})
    throw err
  }
}

async function findAssetsDir(sandbox: Sandbox, workingDir: string): Promise<string | null> {
  const clientDir = `${workingDir}/dist/client`
  const distDir = `${workingDir}/dist`

  if (await directoryExists(sandbox, clientDir)) return clientDir
  if (await directoryExists(sandbox, distDir)) return distDir
  return null
}

async function readEnvFile(
  sandbox: Sandbox,
  path: string,
): Promise<Record<string, string> | undefined> {
  try {
    return parseDotEnv(await downloadFileSafe(sandbox, path))
  } catch {
    return undefined
  }
}

export async function initializeProject(
  args: InitializeProjectArgs,
): Promise<{ projectId: string; sandboxId: string; previewUrl: string }> {
  console.log('[init] starting...', { userId: args.userId, githubUrl: args.githubUrl })
  const projectCount = await ProjectService.countProjectsByOrganizationId(args.organizationId)
  console.log('[init] project count:', projectCount)
  if (projectCount >= MAX_PROJECTS_PER_ORG) {
    throw new HttpError(
      400,
      `Project limit reached. Maximum ${MAX_PROJECTS_PER_ORG} projects per organization.`,
    )
  }

  const created = await ProjectService.createProject({
    userId: args.userId,
    organizationId: args.organizationId,
    name: args.name || 'app',
    githubUrl: args.githubUrl,
  })
  const projectId = created.id
  const workingDirectory = workspacePath(projectId)

  const defaultRedirectUri = `https://project-${projectId.slice(0, 8)}.${
    config.cloudflare.deployDomain
  }/oauth/callback`
  const oauthClient = await auth.api.adminCreateOAuthClient({
    headers: args.headers ?? new Headers(),
    body: {
      redirect_uris: [defaultRedirectUri],
      scope: 'openid profile email offline_access',
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      skip_consent: true,
      client_name: args.name || 'app',
      type: 'user-agent-based',
    },
  })

  await db
    .updateTable('oauthClient')
    .set({
      projectId,
      referenceId: args.organizationId,
      updatedAt: new Date(),
    })
    .where('clientId', '=', oauthClient.client_id)
    .execute()

  const apiKeyResult = await auth.api.createApiKey({
    body: { name: `p-${projectId.slice(0, 8)}` },
    headers: args.headers,
  })

  const attached = await ProjectService.attachApiKeyToProject(
    apiKeyResult.id,
    projectId,
    args.organizationId,
  )
  if (!attached) {
    throw new Error('Failed to attach API key to project')
  }

  await db
    .insertInto('env_var')
    .values({
      projectId,
      environment: 'development',
      key: 'SURGENT_API_KEY',
      value: apiKeyResult.key,
      createdAt: new Date(),
      updatedAt: new Date(),
      destination: 'server',
    })
    .execute()

  console.log('[init] creating sandbox...')
  if (!config.surgent.baseUrl || !config.opencode.baseUrl) {
    throw new Error('SURGENT_BASE_URL and OPENCODE_BASE_URL are not set')
  }
  const devEnv = await getProjectEnvVars(projectId, 'development', { includeServer: false })
  const opencodeConfigDir = config.opencode.configDir
  const opencodeEnv = {
    ...devEnv,
    SURGENT_API_KEY: apiKeyResult.key,
    SURGENT_BASE_URL: config.surgent.baseUrl,
    OPENCODE_API_KEY: apiKeyResult.key,
    OPENCODE_BASE_URL: config.opencode.baseUrl,
    OPENCODE_CONFIG_DIR: opencodeConfigDir,
  }
  const { sandbox, previewUrl } = await getOrCreateSandbox({
    port: PREVIEW_PORT,
    workingDirectory,
    name: 'server',
    env: opencodeEnv,
  })
  console.log('[init] sandbox created:', sandbox.id, 'provider:', defaultProviderName)

  if (args.githubUrl) {
    console.log('[init] cloning template...')
    await sandbox.clone(args.githubUrl, workingDirectory)
    const reset = await sandbox.exec(
      buildBashCommand(workingDirectory, 'rm -rf .git && git init -b main'),
      {
        timeout: 60_000,
      },
    )
    if (reset.code !== 0) {
      throw new Error(`Failed to reset git after clone: ${reset.output}`)
    }
    console.log('[init] template cloned, git reset')
  }

  let initScript: string | undefined
  let devScript: string | undefined
  let processName = `${projectId}-vite-server`
  try {
    console.log('[init] reading surgent.json...')
    const content = (await sandbox.read(`${workingDirectory}/surgent.json`)).toString('utf8')
    console.log('[init] surgent.json found, parsing...')
    const cfg = JSON.parse(stripJsonComments(content))
    initScript = cfg?.scripts?.init
    devScript = cfg?.scripts?.dev
    if (cfg?.name?.trim()) processName = cfg.name.trim()
    console.log('[init] config:', { initScript, devScript, processName })
  } catch (err) {
    console.log('[init] no surgent.json or parse error:', err)
  }

  if (initScript)
    await sandbox.exec(buildBashCommand(workingDirectory, initScript), { timeout: 600_000 })
  if (devScript) await ensurePm2Process(sandbox, workingDirectory, processName, devScript, devEnv)
  await ensureOpencodeConfigRepo(sandbox, config.opencode.configRepoUrl, opencodeConfigDir)
  await startOpencodeServer(sandbox, workingDirectory, opencodeEnv)

  await ProjectService.updateProject(projectId, {
    metadata: { workingDirectory, processName, startCommand: devScript },
  })
  await ProjectService.upsertSandbox({
    id: sandbox.id,
    projectId,
    provider: defaultProviderName,
    status: 'started',
    host: previewUrl,
  })

  return { projectId, sandboxId: sandbox.id, previewUrl }
}

export async function resumeProject(
  args: ResumeProjectArgs,
): Promise<{ sandboxId: string; previewUrl: string }> {
  const workingDirectory = workspacePath(args.projectId)
  const devEnv = await getProjectEnvVars(args.projectId, 'development', { includeServer: false })
  const opencodeConfigDir = config.opencode.configDir
  const opencodeKey = devEnv.OPENCODE_API_KEY || devEnv.SURGENT_API_KEY
  const opencodeEnv = {
    ...devEnv,
    ...(opencodeKey ? { OPENCODE_API_KEY: opencodeKey } : {}),
    ...(config.surgent.baseUrl ? { SURGENT_BASE_URL: config.surgent.baseUrl } : {}),
    ...(config.opencode.baseUrl ? { OPENCODE_BASE_URL: config.opencode.baseUrl } : {}),
    OPENCODE_CONFIG_DIR: opencodeConfigDir,
  }

  const { sandbox, previewUrl } = await getOrCreateSandbox({
    sandboxId: args.sandboxId,
    port: PREVIEW_PORT,
    workingDirectory,
    name: 'server',
    env: opencodeEnv,
  })

  try {
    const project = await ProjectService.getProjectById(args.projectId)
    const metadata = project?.metadata as ProjectMetadata | null
    if (metadata?.startCommand && metadata?.processName) {
      await ensurePm2Process(
        sandbox,
        workingDirectory,
        metadata.processName,
        metadata.startCommand,
        devEnv,
      )
    }

    await ensureOpencodeConfigRepo(sandbox, config.opencode.configRepoUrl, opencodeConfigDir)
    await startOpencodeServer(sandbox, workingDirectory, opencodeEnv)
  } catch (err) {
    console.log('[resume] error', err)
  }

  await ProjectService.upsertSandbox({
    id: sandbox.id,
    projectId: args.projectId,
    provider: defaultProviderName,
    status: 'started',
    host: previewUrl,
  })

  return { sandboxId: sandbox.id, previewUrl }
}

export async function deployConvexProd(args: { projectId: string }): Promise<void> {
  const project = await ProjectService.getProjectById(args.projectId)
  if (!project) throw new Error(`Project ${args.projectId} not found`)

  const sandboxRow = await ProjectService.getSandboxByProjectId(args.projectId)
  if (!sandboxRow?.id) throw new Error('Sandbox not found')

  const sandbox = await getProvider().resume(sandboxRow.id)
  const cwd = project.metadata?.workingDirectory || workspacePath(args.projectId)

  const res = await sandbox.exec('bunx convex deploy -y', { cwd, timeout: 180_000 })
  if (res.code !== 0) throw new Error(`convex deploy failed: ${res.output}`)
}

export async function downloadProject(
  args: DownloadProjectArgs,
): Promise<{ buffer: Buffer; filename: string }> {
  const { projectId } = args
  const project = await ProjectService.getProjectById(projectId)
  if (!project) throw new HttpError(404, 'Project not found')

  const sandboxRow = await ProjectService.getSandboxByProjectId(projectId)
  if (!sandboxRow?.id) throw new HttpError(400, 'Sandbox not initialized')

  const sandbox = await getProvider().resume(sandboxRow.id)
  const metadata = project.metadata as ProjectMetadata | null
  const workingDir = metadata?.workingDirectory || workspacePath(projectId)
  const archivePath = `/tmp/${projectId}-download.tar.gz`

  // Use tar (always available) with excludes for large/irrelevant directories and secrets
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

    const buffer = await downloadFileSafe(sandbox, archivePath, workingDir)
    const safeName = (project.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '-')
    return { buffer, filename: `${safeName}.tar.gz` }
  } finally {
    await sandbox.exec(`rm -f ${shellQuote(archivePath)}`).catch(() => {})
  }
}

export async function deleteSandbox(args: DeleteProjectArgs): Promise<void> {
  const project = await ProjectService.getProjectById(args.projectId)
  if (!project) return

  const sandboxRow = await ProjectService.getSandboxByProjectId(args.projectId)
  if (!sandboxRow?.id) return

  try {
    await getProvider().kill(sandboxRow.id)
    console.log('[delete] sandbox deleted', { projectId: args.projectId, sandboxId: sandboxRow.id })
  } catch (err) {
    console.error('[delete] sandbox deletion failed', {
      projectId: args.projectId,
      sandboxId: sandboxRow.id,
      error: err,
    })
  }
}

export async function getSandboxLogs(
  args: GetSandboxLogsArgs,
): Promise<{ app: string; opencode: string }> {
  const { projectId, lines = 100 } = args
  const project = await ProjectService.getProjectById(projectId)
  if (!project) throw new HttpError(404, 'Project not found')

  const sandboxRow = await ProjectService.getSandboxByProjectId(projectId)
  if (!sandboxRow?.id) throw new HttpError(400, 'Sandbox not initialized')

  const sandbox = await getProvider().resume(sandboxRow.id)
  const metadata = project.metadata as ProjectMetadata | null

  const [app, opencode] = await Promise.all([
    metadata?.processName
      ? sandbox.exec(
          `pm2 logs ${metadata.processName} --nostream --lines ${lines} 2>&1 || echo "No app logs"`,
          {
            timeout: 10_000,
          },
        )
      : Promise.resolve({ code: 0, output: 'No app process configured' }),
    sandbox.exec(
      `pm2 logs opencode-server --nostream --lines ${lines} 2>&1 || echo "No opencode logs"`,
      {
        timeout: 10_000,
      },
    ),
  ])

  return { app: app.output, opencode: opencode.output }
}

export async function redeployVersion(args: RedeployVersionArgs): Promise<void> {
  const { projectId, versionId } = args
  if (config.cloudflare.dispatchNamespace) {
    throw new Error('Rollback is not supported for dispatch deployments')
  }

  const worker = await ProjectService.getWorkerByProjectId(projectId)
  if (!worker) throw new Error('No worker found for project')

  const { scriptName, accountId, hostname } = worker
  const client = new Cloudflare({ apiToken: config.cloudflare.apiToken })

  const previous = await ProjectService.getDeploymentByVersionId(projectId, versionId)

  const deployment = await ProjectService.createDeployment({
    projectId,
    scriptName,
    status: 'deploying',
    hostname,
    startedAt: new Date(),
    rollbackOf: previous?.id ?? null,
  })

  try {
    await (client.workers.scripts.deployments.create as any)(scriptName, {
      account_id: accountId,
      strategy: 'all_at_once',
      versions: [{ version_id: versionId, percentage: 100 }],
      metadata: { deployment_message: `Rollback to version ${versionId}` },
    })

    // Fetch new deployment info
    const cfDeployment = await fetchLatestCloudflareDeployment(accountId, scriptName)

    await ProjectService.updateDeployment(deployment.id, {
      status: 'deployed',
      finishedAt: new Date(),
      cloudflareDeploymentId: cfDeployment?.id ?? null,
      cloudflareVersionId: cfDeployment?.versionId ?? null,
    })

    console.log('[rollback] success', { projectId, versionId })
  } catch (err: any) {
    await ProjectService.updateDeployment(deployment.id, {
      status: 'deploy_failed',
      error: err?.message || 'Rollback failed',
      finishedAt: new Date(),
    })
    throw err
  }
}
