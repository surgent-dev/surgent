import { createDeployment, createDeployKey, setDeploymentEnvVars } from '@/apis/convex'
import * as ProjectService from '@/services/projects'

// ============================================================================
// Types
// ============================================================================

export interface ConvexIntegrationConfig {
  convexProjectId?: string
  region?: string
  deployments?: {
    development?: { name?: string; url?: string }
    production?: { name?: string; url?: string }
  }
}

export type ConvexEnv = 'development' | 'production'

export interface ConvexCredentials {
  deploymentName: string
  deploymentUrl: string
  deployKey: string
}

// ============================================================================
// Helpers
// ============================================================================

export function parseDeploymentName(value: string | undefined): string | undefined {
  if (!value) return undefined
  const idx = value.indexOf(':')
  if (idx === -1) return value
  return value.slice(idx + 1) || undefined
}

export function parseDeploymentNameFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = value.match(/^https?:\/\/([a-z0-9-]+)\.convex\.cloud(?:\/|$)/i)
  return match?.[1]
}

export function toEnvMap(rows: { key: string; value: string | null }[]): Record<string, string> {
  return Object.fromEntries(
    rows.filter((row) => row.value).map((row) => [row.key, row.value as string]),
  )
}

export function withDeployment(
  cfg: ConvexIntegrationConfig,
  env: ConvexEnv,
  dep: { name: string; url: string },
): ConvexIntegrationConfig {
  return { ...cfg, deployments: { ...cfg.deployments, [env]: dep } }
}

export async function resolveConvexIntegrationConfig(
  projectId: string,
  configValue: unknown,
): Promise<ConvexIntegrationConfig> {
  const cfg =
    configValue && typeof configValue === 'object'
      ? ({ ...configValue } as ConvexIntegrationConfig)
      : {}
  const deployments = { ...cfg.deployments }

  const [dev, prod] = await Promise.all([
    getConvexCredentials(projectId, 'development'),
    getConvexCredentials(projectId, 'production'),
  ])

  if (dev) {
    deployments.development = {
      ...deployments.development,
      name: dev.deploymentName,
      url: dev.deploymentUrl,
    }
  } else {
    delete deployments.development
  }

  if (prod) {
    deployments.production = {
      ...deployments.production,
      name: prod.deploymentName,
      url: prod.deploymentUrl,
    }
  } else {
    delete deployments.production
  }

  return { ...cfg, deployments }
}

// Env vars that are inherently environment-specific and must not leak from dev to prod
const ENV_SPECIFIC_KEYS = new Set(['SITE_URL'])

// ============================================================================
// Core
// ============================================================================

export async function getConvexCredentials(
  projectId: string,
  env: ConvexEnv,
): Promise<ConvexCredentials | null> {
  const rows = await ProjectService.getEnvVarsByProjectId(projectId, env)
  const envMap = toEnvMap(rows)

  const deploymentUrl = envMap.CONVEX_URL
  const deploymentName =
    parseDeploymentName(envMap.CONVEX_DEPLOYMENT) ?? parseDeploymentNameFromUrl(deploymentUrl)
  const deployKey = envMap.CONVEX_DEPLOY_KEY
  if (!deploymentName || !deploymentUrl || !deployKey) return null

  return { deploymentName, deploymentUrl, deployKey }
}

/**
 * Idempotent: resolve or create a production Convex deployment,
 * persist credentials to env_var, and sync config.deployments for the frontend.
 */
export async function ensureConvexProdDeployment(projectId: string): Promise<void> {
  const convex = await ProjectService.getIntegrationByProvider(projectId, 'convex')
  if (!convex?.id) return

  const cfg = (convex.config ?? {}) as ConvexIntegrationConfig
  if (!cfg.convexProjectId) return

  const prodEnv = toEnvMap(await ProjectService.getEnvVarsByProjectId(projectId, 'production'))
  const prodCfg = cfg.deployments?.production

  // Resolve existing or create new
  let url = prodEnv.CONVEX_URL ?? prodCfg?.url
  let name =
    parseDeploymentName(prodEnv.CONVEX_DEPLOYMENT) ??
    parseDeploymentNameFromUrl(url) ??
    prodCfg?.name
  if (!name || !url) {
    const created = await createDeployment({
      projectId: cfg.convexProjectId,
      type: 'prod',
      region: cfg.region,
    })
    name = created.name
    url = created.deploymentUrl
  }
  const deployKey = prodEnv.CONVEX_DEPLOY_KEY ?? (await createDeployKey(name))

  // Copy dev server vars that don't already exist in prod (skip env-specific keys like SITE_URL)
  const devRows = await ProjectService.getEnvVarsByProjectId(projectId, 'development')
  const devServerVars: Record<string, { value: string; destination: 'server' | 'both' }> = {}
  for (const row of devRows) {
    if (
      row.value &&
      (row.destination === 'server' || row.destination === 'both') &&
      !(row.key in prodEnv) &&
      !ENV_SPECIFIC_KEYS.has(row.key)
    ) {
      devServerVars[row.key] = { value: row.value, destination: row.destination }
    }
  }

  // Persist to env_var (source of truth)
  await ProjectService.upsertEnvVars(
    projectId,
    'production',
    {
      CONVEX_DEPLOYMENT: { value: `prod:${name}`, destination: 'client' },
      CONVEX_URL: { value: url, destination: 'client' },
      CONVEX_DEPLOY_KEY: { value: deployKey, destination: 'client' },
      VITE_CONVEX_URL: { value: url, destination: 'client' },
      ...devServerVars,
    },
    convex.id,
  )

  // Sync config.deployments for frontend tab visibility
  if (prodCfg?.name !== name || prodCfg?.url !== url) {
    await ProjectService.updateIntegrationConfig(
      convex.id,
      withDeployment(cfg, 'production', { name, url }),
    )
  }
}

/**
 * Push server + both env vars to the production Convex deployment.
 * Dev vars as base, prod overrides.
 */
export async function syncServerVarsToConvex(projectId: string): Promise<void> {
  const convex = await ProjectService.getIntegrationByProvider(projectId, 'convex')
  if (!convex?.id) return

  const [prodRows, devRows] = await Promise.all([
    ProjectService.getEnvVarsByProjectId(projectId, 'production'),
    ProjectService.getEnvVarsByProjectId(projectId, 'development'),
  ])

  const prodEnv = toEnvMap(prodRows)
  if (!prodEnv.CONVEX_URL || !prodEnv.CONVEX_DEPLOY_KEY) return

  // Dev vars as base (excluding env-specific keys), prod vars override
  const serverVars: Record<string, string> = {}
  for (const row of devRows) {
    if (
      row.value &&
      (row.destination === 'server' || row.destination === 'both') &&
      row.key !== 'CONVEX_DEPLOY_KEY' &&
      !ENV_SPECIFIC_KEYS.has(row.key)
    ) {
      serverVars[row.key] = row.value
    }
  }
  for (const row of prodRows) {
    if (
      row.value &&
      (row.destination === 'server' || row.destination === 'both') &&
      row.key !== 'CONVEX_DEPLOY_KEY'
    ) {
      serverVars[row.key] = row.value
    }
  }

  if (Object.keys(serverVars).length) {
    await setDeploymentEnvVars(prodEnv.CONVEX_URL, prodEnv.CONVEX_DEPLOY_KEY, serverVars)
  }
}

/**
 * Sync server/both env vars to the Convex deployment for a specific environment.
 * Fire-and-forget safe — silently returns if Convex is not provisioned.
 */
export async function syncEnvVarsToConvexForEnv(projectId: string, env: ConvexEnv): Promise<void> {
  const creds = await getConvexCredentials(projectId, env)
  if (!creds) return

  const rows = await ProjectService.getEnvVarsByProjectId(projectId, env)
  const serverVars: Record<string, string> = {}
  for (const row of rows) {
    if (
      row.value &&
      (row.destination === 'server' || row.destination === 'both') &&
      row.key !== 'CONVEX_DEPLOY_KEY'
    ) {
      serverVars[row.key] = row.value
    }
  }

  if (Object.keys(serverVars).length) {
    await setDeploymentEnvVars(creds.deploymentUrl, creds.deployKey, serverVars)
  }
}
