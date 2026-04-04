import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { TERMINAL_DEPLOYMENT_STATUSES } from '@/lib/deployment'
import { http } from '@/lib/http'
import { CreateProjectResponseSchema, ProjectSchema, ProjectsSchema } from '@/lib/schemas/project'

const PROJECT_POLL_INTERVAL_MS = 1000

// Recent deployed projects (public, no auth)
const RecentProjectSchema = z.object({
  name: z.string(),
  liveUrl: z.string(),
})

const RecentProjectsSchema = z.array(RecentProjectSchema)

type RecentProject = z.infer<typeof RecentProjectSchema>

async function fetchRecentProjects(limit = 20): Promise<RecentProject[]> {
  const data = await http.get(`api/projects/recent?limit=${limit}`).json()
  return RecentProjectsSchema.parse(data)
}

export function useRecentProjectsQuery(limit = 20) {
  return useQuery({
    queryKey: ['recent-projects', limit],
    queryFn: () => fetchRecentProjects(limit),
    staleTime: 60_000,
  })
}

async function fetchProjects() {
  const data = await http.get('api/projects').json()
  return ProjectsSchema.parse(data)
}

type CreateProjectArgs = {
  githubUrl: string
  name?: string
  initConvex: boolean
  metadata?: {
    onboarding?: {
      identity?: string
      goal?: string
      industry?: string
      businessName?: string
      location?: string
      stage?: string
      audience?: string
      prompt: string
    }
  }
}

async function postProject({ githubUrl, name, initConvex, metadata }: CreateProjectArgs) {
  const data = await http
    .post('api/projects', { json: { githubUrl, name, initConvex, metadata } })
    .json()
  return CreateProjectResponseSchema.parse(data)
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    refetchInterval: (query) => {
      const projects = query.state.data
      if (!projects) return PROJECT_POLL_INTERVAL_MS
      return projects.some((p) => p.status === 'provisioning') ? PROJECT_POLL_INTERVAL_MS : false
    },
    refetchIntervalInBackground: false,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: CreateProjectArgs) => postProject(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

// New: single project
async function fetchProject(id: string) {
  const data = await http.get(`api/projects/${id}`).json()
  return ProjectSchema.parse(data)
}

export function useProjectQuery(id?: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'provisioning' ? PROJECT_POLL_INTERVAL_MS : 60_000
    },
    refetchIntervalInBackground: false,
    staleTime: 1000,
  })
}

// New: activate project
const ScheduledSchema = z.object({ scheduled: z.boolean() })

async function activateProjectReq({ id }: { id: string }) {
  const data = await http.post(`api/projects/${id}/activate`).json()
  // activate returns full project row; accept either shape for resiliency
  try {
    return ProjectSchema.parse(data)
  } catch {
    return ScheduledSchema.parse(data)
  }
}

export function useActivateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activateProjectReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['sandbox-health', vars.id] })
    },
  })
}

// New: deploy project
const DeployResponseSchema = z.object({ deploymentId: z.string(), status: z.string() })

async function deployProjectReq({ id, deployName }: { id: string; deployName?: string }) {
  const data = await http.post(`api/projects/${id}/deploy`, { json: { deployName } }).json()
  return DeployResponseSchema.parse(data)
}

async function confirmHostnameReq({ id, name }: { id: string; name: string }) {
  const data = await http
    .post(`api/projects/${id}/deployment/confirm-hostname`, { json: { name } })
    .json()
  return data as { confirmed: boolean; name: string; previewUrl: string }
}

export function useDeployProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deployProjectReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['latest-deployment', vars.id] })
    },
  })
}

// Cancel deployment
async function cancelDeploymentReq({ id, deploymentId }: { id: string; deploymentId: string }) {
  const data = await http.post(`api/projects/${id}/deployments/${deploymentId}/cancel`).json()
  return data as { cancelled: boolean }
}

export function useCancelDeployment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelDeploymentReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['latest-deployment', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
    },
  })
}

async function undeployProjectReq({ id }: { id: string }) {
  const data = await http.post(`api/projects/${id}/undeploy`).json()
  return ScheduledSchema.parse(data)
}

export function useUndeployProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: undeployProjectReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useConfirmHostname() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmHostnameReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// Check hostname availability
async function checkHostnameAvailability(name: string, projectId?: string) {
  const params = new URLSearchParams({ name })
  if (projectId) params.set('projectId', projectId)
  const data: { available: boolean } = await http
    .get(`api/projects/check-hostname?${params}`)
    .json()
  return data
}

export function useHostnameAvailability(name: string, projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['hostname-availability', name, projectId],
    queryFn: () => checkHostnameAvailability(name, projectId),
    enabled: enabled && name.length > 0,
    staleTime: 10000,
    placeholderData: (prev) => prev,
  })
}

// Generate random hostname
export function useGenerateHostname(enabled = false) {
  return useQuery({
    queryKey: ['generate-hostname'],
    queryFn: () => http.get('api/projects/generate-hostname').json<{ name: string }>(),
    enabled,
    staleTime: Infinity,
  })
}

// Rename project
async function renameProjectReq({ id, name }: { id: string; name: string }) {
  await http.patch(`api/projects/${id}`, { json: { name } }).json()
}

export function useRenameProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: renameProjectReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// Update project visibility
async function updateVisibilityReq({ id, isPublic }: { id: string; isPublic: boolean }) {
  await http.patch(`api/projects/${id}`, { json: { isPublic } }).json()
}

export function useUpdateProjectVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateVisibilityReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// Delete project
async function deleteProjectReq({ id }: { id: string }) {
  await http.delete(`api/projects/${id}`).json()
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProjectReq,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// Environment variables
export interface EnvVarItem {
  key: string
  value: string | null
  destination: 'server' | 'client' | 'both' | null
}

async function fetchEnvVars(
  id: string,
  environment: 'development' | 'production',
): Promise<EnvVarItem[]> {
  return http.get(`api/projects/${id}/env?environment=${environment}`).json()
}

export function useEnvVarsQuery(
  projectId?: string,
  environment: 'development' | 'production' = 'development',
) {
  return useQuery({
    queryKey: ['env-vars', projectId, environment],
    queryFn: () => fetchEnvVars(projectId!, environment),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

async function upsertEnvVarReq({
  id,
  environment,
  key,
  value,
  destination,
}: {
  id: string
  environment: 'development' | 'production'
  key: string
  value: string
  destination?: 'server' | 'client' | 'both'
}) {
  return http
    .put(`api/projects/${id}/env`, { json: { environment, key, value, destination } })
    .json()
}

export function useUpsertEnvVar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertEnvVarReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['env-vars', vars.id] })
    },
  })
}

async function deleteEnvVarReq({
  id,
  environment,
  key,
}: {
  id: string
  environment: 'development' | 'production'
  key: string
}) {
  return http.delete(`api/projects/${id}/env`, { json: { environment, key } }).json()
}

export function useDeleteEnvVar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEnvVarReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['env-vars', vars.id] })
    },
  })
}

// Sandbox health check
type SandboxStatus = 'running' | 'paused' | 'no_sandbox' | 'not_found' | 'forbidden'

async function fetchSandboxHealth(id: string): Promise<{ status: SandboxStatus }> {
  return http.get(`api/projects/${id}/health`).json()
}

export function useSandboxHealthQuery(id?: string, enabled = true) {
  return useQuery({
    queryKey: ['sandbox-health', id],
    queryFn: () => fetchSandboxHealth(id!),
    enabled: Boolean(id) && enabled,
    // Only poll when tab is focused; pause when hidden
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Poll faster when not running yet, slower when stable
      return status === 'running' ? 30000 : 5000
    },
    refetchIntervalInBackground: false,
    staleTime: 5000,
  })
}

// Convex dashboard credentials
export interface ConvexDashboardCredentials {
  adminKey: string
  deploymentUrl: string
  deploymentName: string
}

async function fetchConvexDashboard(
  id: string,
  env: 'development' | 'production' = 'development',
): Promise<ConvexDashboardCredentials> {
  return http.get(`api/projects/${id}/convex/dashboard?env=${env}`).json()
}

export function useConvexDashboardQuery(
  id?: string,
  env: 'development' | 'production' = 'development',
  enabled = true,
) {
  return useQuery({
    queryKey: ['convex-dashboard', id, env],
    queryFn: () => fetchConvexDashboard(id!, env),
    enabled: Boolean(id) && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  })
}

// Sandbox PM2 logs
export interface SandboxLogs {
  app: string
  opencode: string
}

async function fetchSandboxLogs(id: string): Promise<SandboxLogs> {
  return http.get(`api/projects/${id}/logs`).json()
}

export function useSandboxLogsQuery(id?: string, enabled = true) {
  return useQuery({
    queryKey: ['sandbox-logs', id],
    queryFn: () => fetchSandboxLogs(id!),
    enabled: Boolean(id) && enabled,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  })
}

// Deployment history
const DeploymentEnvSnapshotSchema = z
  .object({
    vars: z.record(z.string(), z.string()).optional(),
    keys: z.array(z.string()).optional(),
    capturedAt: z.string().optional(),
  })
  .nullable()
  .optional()

const DeploymentItemSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  deployedAt: z.string().optional(),
  error: z.string().optional(),
  cloudflareVersionId: z.string().nullable().optional(),
  hostname: z.string().nullable().optional(),
  rollbackOf: z.string().nullable().optional(),
  scriptName: z.string().optional(),
  envSnapshot: DeploymentEnvSnapshotSchema,
  screenshotUrl: z.string().nullable().optional(),
})

const DeploymentHistorySchema = z.array(DeploymentItemSchema)

export type DeploymentItem = z.infer<typeof DeploymentItemSchema>

async function fetchDeploymentHistory(id: string): Promise<DeploymentItem[]> {
  const data = await http.get(`api/projects/${id}/deployments`).json()
  return DeploymentHistorySchema.parse(data)
}

export function useDeploymentHistoryQuery(id?: string, enabled = true) {
  return useQuery({
    queryKey: ['deployment-history', id],
    queryFn: () => fetchDeploymentHistory(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 30000,
  })
}

// Cloudflare deployments
const CloudflareDeploymentSchema = z.object({
  id: z.string(),
  created_on: z.string(),
  version_id: z.string().nullable(),
  hostname: z.string().nullable().optional(),
  is_rollback: z.boolean().optional(),
})

export type CloudflareDeployment = z.infer<typeof CloudflareDeploymentSchema>

async function fetchCloudflareDeployments(id: string): Promise<CloudflareDeployment[]> {
  const data = await http.get(`api/projects/${id}/deployments`).json()
  const items = DeploymentHistorySchema.parse(data)
  const deployments = items
    .filter((item) => item.status === 'deployed')
    .map((item) => ({
      id: item.id,
      created_on: item.createdAt,
      version_id: item.cloudflareVersionId ?? null,
      hostname: item.hostname ?? null,
      is_rollback: Boolean(item.rollbackOf),
    }))
  return z.array(CloudflareDeploymentSchema).parse(deployments)
}

export function useCloudflareDeploymentsQuery(projectId: string) {
  return useQuery({
    queryKey: ['cloudflare-deployments', projectId],
    queryFn: () => fetchCloudflareDeployments(projectId),
    enabled: Boolean(projectId),
    staleTime: 60000, // 1 minute - don't refetch unless stale
    gcTime: 300000, // 5 minutes cache
  })
}

async function redeployVersionReq({ id, versionId }: { id: string; versionId: string }) {
  const data = await http
    .post(`api/projects/${id}/cloudflare-redeploy`, { json: { versionId } })
    .json()
  return ScheduledSchema.parse(data)
}

export function useRedeployVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redeployVersionReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['cloudflare-deployments', vars.id] })
    },
  })
}

// Deployment status
const DeploymentStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
  hostname: z.string().nullable(),
  scriptName: z.string(),
  screenshotUrl: z.string().nullable(),
})

export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>

// Fetch latest deployment for a project
async function fetchLatestDeployment(projectId: string): Promise<DeploymentStatus | null> {
  const data = await http.get(`api/projects/${projectId}/deployments`).json()
  const items = DeploymentHistorySchema.parse(data)
  if (!items.length) return null
  const latest = items[0]! // Already sorted by createdAt desc
  return {
    id: latest.id,
    status: latest.status,
    createdAt: latest.createdAt,
    startedAt: latest.startedAt,
    finishedAt: latest.deployedAt,
    error: latest.error,
    hostname: latest.hostname ?? null,
    scriptName: latest.scriptName || 'unknown',
    screenshotUrl: latest.screenshotUrl ?? null,
  }
}

export function useLatestDeploymentQuery(projectId: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['latest-deployment', projectId],
    queryFn: async () => {
      const result = await fetchLatestDeployment(projectId!)
      // Invalidate project when deployment completes to refresh worker status
      if (result && TERMINAL_DEPLOYMENT_STATUSES.includes(result.status)) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      }
      return result
    },
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || TERMINAL_DEPLOYMENT_STATUSES.includes(status)) {
        return false // Don't poll when done
      }
      return 2000 // Poll every 2s while in progress
    },
    refetchIntervalInBackground: false,
    staleTime: 1000,
  })
}
