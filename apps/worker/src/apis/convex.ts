import { config } from '@/lib/config'

async function convexApi(path: string, init?: RequestInit) {
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

  return res.json()
}

export interface ConvexProject {
  projectId: string
  projectSlug: string
  deploymentName: string
  deploymentUrl: string
}

export async function createProjectOnTeam(args: {
  name: string
  deploymentType?: 'dev' | 'prod'
}): Promise<ConvexProject> {
  const body: any = await convexApi(`/teams/${config.convex.teamId}/create_project`, {
    method: 'POST',
    body: JSON.stringify({
      projectName: args.name,
      deploymentType: args.deploymentType ?? 'dev',
    }),
  })

  return {
    projectId: body.projectId,
    projectSlug: body.projectSlug,
    deploymentName: body.deploymentName,
    deploymentUrl: body.deploymentUrl,
  }
}

export async function createDeployKey(deploymentName: string): Promise<string> {
  const body: any = await convexApi(`/deployments/${encodeURIComponent(deploymentName)}/create_deploy_key`, {
    method: 'POST',
    body: JSON.stringify({ name: 'surgent' }),
  })
  return body.deployKey
}

export async function setDeploymentEnvVars(
  deploymentUrl: string,
  deployKey: string,
  vars: Record<string, string>
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
  deployKey: string
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

  const body: any = await res.json()
  return body.environmentVariables || {}
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
  args: Record<string, ConvexValue> = {}
): Promise<ConvexFunctionResult> {
  const res = await fetch(`${deploymentUrl}/api/query`, {
    method: 'POST',
    headers: {
      Authorization: `Convex ${deployKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })

  const body: { value?: ConvexValue; message?: string; errorMessage?: string; errorData?: ConvexValue } = await res.json()

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
  args: Record<string, ConvexValue> = {}
): Promise<ConvexFunctionResult> {
  const res = await fetch(`${deploymentUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      Authorization: `Convex ${deployKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })

  const body: { value?: ConvexValue; message?: string; errorMessage?: string; errorData?: ConvexValue } = await res.json()

  if (!res.ok) {
    return {
      status: 'error',
      errorMessage: body.message || body.errorMessage || `Mutation failed: ${res.status}`,
      errorData: body.errorData,
    }
  }

  return { status: 'success', value: body.value ?? null }
}
