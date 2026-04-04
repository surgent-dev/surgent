import { config } from '@/lib/config'
import { generateKeyPair, exportPKCS8, exportJWK } from 'jose'

async function safeJsonParse<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text || `Invalid JSON response`)
  }
}

async function convexApi<T>(path: string, init?: RequestInit): Promise<T> {
  if (!config.convex.teamToken || !config.convex.teamId) {
    throw new Error('Missing CONVEX_TEAM_TOKEN or CONVEX_TEAM_ID')
  }

  const base = config.convex.host || 'https://api.convex.dev'
  const res = await fetch(`${base}/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.convex.teamToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Convex API ${res.status}`)
  }

  return safeJsonParse<T>(res)
}

export interface ConvexProject {
  projectId: string
  projectSlug: string
  deploymentName: string
  deploymentUrl: string
  deploymentRegion?: string
}

interface CreateProjectResponse {
  projectId: string
  projectSlug: string
  deploymentName: string
  deploymentUrl: string
}

interface CreateDeploymentResponse {
  name: string
  deploymentType: 'dev' | 'prod' | 'preview' | 'custom'
  projectId: number
  deploymentUrl?: string
  region?: string
}

interface CreateDeployKeyResponse {
  deployKey: string
}

export interface DeploymentRegion {
  name: string
  displayName: string
  available: boolean
}

interface ListDeploymentRegionsResponse {
  items: DeploymentRegion[]
}

export async function createProjectOnTeam(args: {
  name: string
  deploymentType?: 'dev' | 'prod'
  deploymentRegion?: string
}): Promise<ConvexProject> {
  const body = await convexApi<CreateProjectResponse>(
    `/teams/${config.convex.teamId}/create_project`,
    {
      method: 'POST',
      body: JSON.stringify({
        projectName: args.name,
        deploymentType: args.deploymentType ?? 'dev',
        deploymentRegion: args.deploymentRegion ?? null,
      }),
    },
  )

  return {
    projectId: body.projectId,
    projectSlug: body.projectSlug,
    deploymentName: body.deploymentName,
    deploymentUrl: body.deploymentUrl,
    deploymentRegion: args.deploymentRegion,
  }
}

export async function createDeployment(args: {
  projectId: string
  type: 'dev' | 'prod'
  region?: string
}): Promise<{ name: string; deploymentUrl: string; region?: string }> {
  const body = await convexApi<CreateDeploymentResponse>(
    `/projects/${encodeURIComponent(args.projectId)}/create_deployment`,
    {
      method: 'POST',
      body: JSON.stringify({ type: args.type, region: args.region ?? null }),
    },
  )

  const url = body.deploymentUrl ?? `https://${body.name}.convex.cloud`
  return { name: body.name, deploymentUrl: url, region: body.region ?? args.region }
}

export async function listDeploymentRegions(): Promise<DeploymentRegion[]> {
  const teamId = config.convex.teamId
  if (!teamId) throw new Error('Missing CONVEX_TEAM_ID')

  const body = await convexApi<ListDeploymentRegionsResponse>(
    `/teams/${encodeURIComponent(teamId)}/list_deployment_regions`,
    {
      method: 'GET',
    },
  )

  return body.items
}

export async function createDeployKey(deploymentName: string): Promise<string> {
  const body = await convexApi<CreateDeployKeyResponse>(
    `/deployments/${encodeURIComponent(deploymentName)}/create_deploy_key`,
    {
      method: 'POST',
      body: JSON.stringify({ name: 'surgent' }),
    },
  )
  return body.deployKey
}

export interface AuthKeys {
  privateKey: string
  jwks: string
}

export async function generateAuthKeys(): Promise<AuthKeys> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    extractable: true,
  })

  const privatePem = await exportPKCS8(privateKey)
  const publicJwk = await exportJWK(publicKey)
  const jwks = JSON.stringify({ keys: [{ use: 'sig', alg: 'RS256', ...publicJwk }] })

  return {
    privateKey: privatePem.trimEnd().replace(/\n/g, ' '),
    jwks,
  }
}

export async function setDeploymentEnvVars(
  deploymentUrl: string,
  deployKey: string,
  vars: Record<string, string>,
): Promise<void> {
  const changes = Object.entries(vars).map(([name, value]) => ({ name, value }))
  if (!changes.length) return

  const res = await fetch(`${deploymentUrl}/api/update_environment_variables`, {
    method: 'POST',
    headers: {
      Authorization: `Convex ${deployKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ changes }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Set env vars failed: ${res.status}`)
  }
}

export async function listDeploymentEnvVars(
  deploymentUrl: string,
  deployKey: string,
): Promise<Record<string, string>> {
  const res = await fetch(`${deploymentUrl}/api/v1/list_environment_variables`, {
    method: 'GET',
    headers: {
      Authorization: `Convex ${deployKey}`,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `List env vars failed: ${res.status}`)
  }

  const body = (await res.json()) as { environmentVariables: Record<string, string> }
  return body.environmentVariables
}

export interface DashboardCredentials {
  adminKey: string
  deploymentUrl: string
  deploymentName: string
}

/**
 * Construct dashboard credentials from project metadata.
 * The adminKey is just the deploy key directly.
 */
export function buildDashboardCredentials(args: {
  deploymentName: string
  deploymentUrl: string
  deployKey: string
}): DashboardCredentials {
  return {
    adminKey: args.deployKey,
    deploymentUrl: args.deploymentUrl,
    deploymentName: args.deploymentName,
  }
}

/**
 * Delete a Convex project
 */
export async function deleteProject(projectId: string): Promise<void> {
  await convexApi(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
}

// Types for Convex function calls
export type ConvexValue =
  | null
  | boolean
  | number
  | string
  | ArrayBuffer
  | ConvexValue[]
  | { [key: string]: ConvexValue }

export interface ConvexFunctionSuccess {
  status: 'success'
  value: ConvexValue
}

export interface ConvexFunctionError {
  status: 'error'
  errorMessage: string
  errorData?: ConvexValue
}

export type ConvexFunctionResult = ConvexFunctionSuccess | ConvexFunctionError

interface ConvexFunctionResponse {
  value?: ConvexValue
  message?: string
  errorMessage?: string
  errorData?: ConvexValue
}

/**
 * Call a Convex query function
 * @param deploymentUrl - The deployment URL (e.g., https://xyz.convex.cloud)
 * @param deployKey - The deploy key for authentication
 * @param path - Function path in format "file:functionName" (e.g., "messages:list")
 * @param args - Arguments to pass to the function
 */
export async function callQuery(
  deploymentUrl: string,
  deployKey: string,
  path: string,
  args: Record<string, ConvexValue> = {},
): Promise<ConvexFunctionResult> {
  const res = await fetch(`${deploymentUrl}/api/query`, {
    method: 'POST',
    headers: {
      Authorization: `Convex ${deployKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })

  const body: {
    value?: ConvexValue
    message?: string
    errorMessage?: string
    errorData?: ConvexValue
  } = await res.json()

  if (!res.ok) {
    return {
      status: 'error',
      errorMessage: body.message || body.errorMessage || `Query failed: ${res.status}`,
      errorData: body.errorData,
    }
  }

  return { status: 'success', value: body.value ?? null }
}

/**
 * Call a Convex mutation function
 * @param deploymentUrl - The deployment URL (e.g., https://xyz.convex.cloud)
 * @param deployKey - The deploy key for authentication
 * @param path - Function path in format "file:functionName" (e.g., "messages:send")
 * @param args - Arguments to pass to the function
 */
export async function callMutation(
  deploymentUrl: string,
  deployKey: string,
  path: string,
  args: Record<string, ConvexValue> = {},
): Promise<ConvexFunctionResult> {
  const res = await fetch(`${deploymentUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      Authorization: `Convex ${deployKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })

  const body: {
    value?: ConvexValue
    message?: string
    errorMessage?: string
    errorData?: ConvexValue
  } = await res.json()

  if (!res.ok) {
    return {
      status: 'error',
      errorMessage: body.message || body.errorMessage || `Mutation failed: ${res.status}`,
      errorData: body.errorData,
    }
  }

  return { status: 'success', value: body.value ?? null }
}

// ── Call action ─────────────────────────────────────────────────────────────

/**
 * Call a Convex action function (for external API calls and side effects)
 * @param deploymentUrl - The deployment URL (e.g., https://xyz.convex.cloud)
 * @param deployKey - The deploy key for authentication
 * @param path - Function path in format "file:functionName" (e.g., "ai:generate")
 * @param args - Arguments to pass to the function
 */
export async function callAction(
  deploymentUrl: string,
  deployKey: string,
  path: string,
  args: Record<string, ConvexValue> = {},
): Promise<ConvexFunctionResult> {
  const res = await fetch(`${deploymentUrl}/api/action`, {
    method: 'POST',
    headers: {
      Authorization: `Convex ${deployKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })

  const body: ConvexFunctionResponse = await res.json()

  if (!res.ok) {
    return {
      status: 'error',
      errorMessage: body.message || body.errorMessage || `Action failed: ${res.status}`,
      errorData: body.errorData,
    }
  }

  return { status: 'success', value: body.value ?? null }
}

// ── Function spec ───────────────────────────────────────────────────────────

export interface FunctionSpec {
  path: string
  functionType: 'Query' | 'Mutation' | 'Action' | 'HttpAction'
  visibility: { kind: 'public' } | { kind: 'internal' }
  args?: Record<string, unknown>
  returns?: Record<string, unknown>
}

/**
 * Fetch all registered function metadata from a deployment via the system query.
 */
export async function fetchFunctionSpec(
  deploymentUrl: string,
  deployKey: string,
): Promise<FunctionSpec[]> {
  const result = await callQuery(deploymentUrl, deployKey, '_system/cli/modules:apiSpec')
  if (result.status === 'error') throw new Error(result.errorMessage)
  return (result.value ?? []) as unknown as FunctionSpec[]
}

// ── Deployment listing ──────────────────────────────────────────────────────

export interface DeploymentInfo {
  name: string
  deploymentType: 'dev' | 'prod' | 'preview' | 'custom'
  url: string
  region?: string
}

/**
 * List all deployments for a project
 */
export async function listDeployments(projectId: string): Promise<DeploymentInfo[]> {
  const body = await convexApi<
    Array<{
      name: string
      deploymentType: 'dev' | 'prod' | 'preview' | 'custom'
      deploymentUrl: string
      region?: string
    }>
  >(`/projects/${encodeURIComponent(projectId)}/list_deployments`, {
    method: 'GET',
  })

  return body.map((deployment) => ({
    name: deployment.name,
    deploymentType: deployment.deploymentType,
    url: deployment.deploymentUrl,
    region: deployment.region,
  }))
}

// ── Insights ────────────────────────────────────────────────────────────────

export interface InsightEntry {
  type: string
  message: string
  severity: 'info' | 'warning' | 'error'
  details?: string
}

const INSIGHTS_QUERY_ID = '9ab3b74e-a725-480b-88a6-43e6bd70bd82'

/**
 * Fetch deployment insights (OCC conflicts, resource limits, etc.) for the last 72 hours.
 */
export async function fetchInsights(
  teamId: string,
  deploymentName: string,
): Promise<InsightEntry[]> {
  if (!config.convex.teamToken) throw new Error('Missing CONVEX_TEAM_TOKEN')

  const base = config.convex.host || 'https://api.convex.dev'
  const now = new Date()
  const from = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    queryId: INSIGHTS_QUERY_ID,
    deploymentName,
    from: from.toISOString(),
    to: now.toISOString(),
  })

  const res = await fetch(
    `${base}/api/dashboard/teams/${encodeURIComponent(teamId)}/usage/query?${params}`,
    {
      headers: {
        Authorization: `Bearer ${config.convex.teamToken}`,
        Origin: 'https://api.convex.dev',
      },
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Insights fetch failed: ${res.status}`)
  }

  const rows = (await res.json()) as string[][]

  return rows.map((row) => ({
    type: row[0] ?? 'unknown',
    message: row[1] ?? '',
    severity: (row[2] as InsightEntry['severity']) ?? 'info',
    details: row[3],
  }))
}

// ── Deployment logs ──────────────────────────────────────────────────────────

export interface LogLine {
  level: 'DEBUG' | 'ERROR' | 'WARN' | 'INFO' | 'LOG'
  messages: string[]
  timestamp: number
  isTruncated?: boolean
}

export interface LogEntry {
  kind?: 'Completion' | 'Progress'
  executionId?: string
  requestId?: string
  identifier: string
  udfType: 'Query' | 'Mutation' | 'Action' | 'HttpAction'
  timestamp: number
  executionTime?: number
  cachedResult?: boolean
  success?: unknown
  error?: string | null
  logLines: LogLine[]
}

export interface LogsResult {
  entries: LogEntry[]
  newCursor: number
}

export async function fetchDeploymentLogs(
  deploymentUrl: string,
  deployKey: string,
  cursor = 0,
): Promise<LogsResult> {
  const res = await fetch(`${deploymentUrl}/api/stream_function_logs?cursor=${cursor}`, {
    method: 'GET',
    headers: { Authorization: `Convex ${deployKey}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Fetch logs failed: ${res.status}`)
  }

  return res.json() as Promise<LogsResult>
}
