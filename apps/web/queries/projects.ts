import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { http } from "@/lib/http"
import { ProjectsSchema, CreateProjectResponseSchema, ProjectSchema } from "@/lib/schemas/project"
import { z } from "zod"

async function fetchProjects() {
  const data = await http.get("api/projects").json()
  return ProjectsSchema.parse(data)
}

async function postProject(githubUrl: string, name: string, initConvex: boolean) {
  try {
    const data = await http.post("api/projects", { json: { githubUrl, name, initConvex } }).json()
    return CreateProjectResponseSchema.parse(data)
  } catch (err) {
    if (err instanceof HTTPError) {
      const body = await err.response.json<{ error?: string }>().catch(() => null)
      throw new Error(body?.error ?? "Failed to create project")
    }
    throw err
  }
}

export function useProjectsQuery() {
  return useQuery({ queryKey: ["projects"], queryFn: fetchProjects })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { githubUrl: string; name?: string; initConvex: boolean }) =>
      postProject(args.githubUrl, args.name ?? "", args.initConvex),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}

// New: single project
async function fetchProject(id: string) {
  const data = await http.get(`api/projects/${id}`).json()
  return ProjectSchema.parse(data)
}

const DEPLOYMENT_IN_PROGRESS_STATUSES = ["queued", "starting", "building", "uploading"]

export function useProjectQuery(id?: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.deployment?.status
      if (status && DEPLOYMENT_IN_PROGRESS_STATUSES.includes(status)) {
        return 3000 // Poll every 3 seconds while deployment is in progress
      }
      return false
    },
  })
}

const DeploymentHistorySchema = z.array(
  z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    previewUrl: z.string().optional(),
    url: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    error: z.string().optional(),
  }),
)

const DeploymentHistoryResponseSchema = z.object({ deployments: DeploymentHistorySchema })

export type DeploymentHistoryEntry = z.infer<typeof DeploymentHistorySchema>[number]

async function fetchDeploymentHistory(id: string) {
  const data = await http.get(`api/projects/${id}/deployments`).json()
  return DeploymentHistoryResponseSchema.parse(data).deployments
}

export function useDeploymentHistoryQuery(id?: string) {
  return useQuery({
    queryKey: ["deployment-history", id],
    queryFn: () => fetchDeploymentHistory(id as string),
    enabled: Boolean(id),
    refetchInterval: 3000,
  })
}

const DeploymentLogsSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
  createdAt: z.string().optional(),
})

const DeploymentLogsResponseSchema = z.object({ logs: z.array(DeploymentLogsSchema) })

export type DeploymentLogEntry = z.infer<typeof DeploymentLogsSchema>

async function fetchDeploymentLogs(id: string) {
  const data = await http.get(`api/projects/${id}/deployment-logs`).json()
  return DeploymentLogsResponseSchema.parse(data).logs
}

export function useDeploymentLogsQuery(id?: string) {
  return useQuery({
    queryKey: ["deployment-logs", id],
    queryFn: () => fetchDeploymentLogs(id as string),
    enabled: Boolean(id),
    refetchInterval: 3000,
  })
}

const VersionSchema = z.object({
  id: z.string().optional(),
  created_on: z.string().optional(),
  modified_on: z.string().optional(),
  number: z.number().optional(),
  source: z.string().optional(),
  message: z.string().optional(),
  metadata: z.unknown().optional(),
})

const VersionsResponseSchema = z.object({ versions: z.array(VersionSchema) })

export type ProjectVersion = z.infer<typeof VersionSchema>

async function fetchProjectVersions(id: string) {
  const data = await http.get(`api/projects/${id}/versions`).json()
  return VersionsResponseSchema.parse(data).versions
}

export function useProjectVersionsQuery(id?: string) {
  return useQuery({
    queryKey: ["project-versions", id],
    queryFn: () => fetchProjectVersions(id as string),
    enabled: Boolean(id),
  })
}

const UploadVersionResponseSchema = z.object({ versionId: z.string().optional() })

async function uploadVersionReq({
  id,
  workerContent,
  metadata,
}: {
  id: string
  workerContent: string
  metadata?: Record<string, unknown>
}) {
  const data = await http.post(`api/projects/${id}/versions/upload`, { json: { workerContent, metadata } }).json()
  return UploadVersionResponseSchema.parse(data)
}

export function useUploadVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadVersionReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-versions", vars.id] })
    },
  })
}

async function deployVersionReq({ id, versionId }: { id: string; versionId: string }) {
  await http.post(`api/projects/${id}/versions/deploy`, { json: { versionId } }).json()
}

export function useDeployVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deployVersionReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deployment-history", vars.id] })
      queryClient.invalidateQueries({ queryKey: ["project-versions", vars.id] })
      queryClient.invalidateQueries({ queryKey: ["project", vars.id] })
    },
  })
}

async function rollbackDeploymentReq({ id, deploymentId }: { id: string; deploymentId: string }) {
  await http.post(`api/projects/${id}/rollback`, { json: { deploymentId } }).json()
}

export function useRollbackDeployment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rollbackDeploymentReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deployment-history", vars.id] })
      queryClient.invalidateQueries({ queryKey: ["project", vars.id] })
    },
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
      queryClient.invalidateQueries({ queryKey: ["project", vars.id] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["sandbox-health", vars.id] })
    },
  })
}

// New: deploy project
async function deployProjectReq({ id, deployName }: { id: string; deployName?: string }) {
  const data = await http.post(`api/projects/${id}/deploy`, { json: { deployName } }).json()
  return ScheduledSchema.parse(data)
}

export function useDeployProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deployProjectReq,
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project", vars.id] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
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
      queryClient.invalidateQueries({ queryKey: ["project", vars.id] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
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
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

// Sandbox health check
type SandboxStatus = "running" | "paused" | "no_sandbox" | "not_found" | "forbidden"

async function fetchSandboxHealth(id: string): Promise<{ status: SandboxStatus }> {
  return http.get(`api/projects/${id}/health`).json()
}

export function useSandboxHealthQuery(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["sandbox-health", id],
    queryFn: () => fetchSandboxHealth(id!),
    enabled: Boolean(id) && enabled,
    refetchInterval: 5000,
    staleTime: 2000,
  })
}

// Convex dashboard credentials
export interface ConvexDashboardCredentials {
  adminKey: string
  deploymentUrl: string
  deploymentName: string
}

async function fetchConvexDashboard(id: string): Promise<ConvexDashboardCredentials> {
  return http.get(`api/projects/${id}/convex/dashboard`).json()
}

export function useConvexDashboardQuery(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["convex-dashboard", id],
    queryFn: () => fetchConvexDashboard(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
