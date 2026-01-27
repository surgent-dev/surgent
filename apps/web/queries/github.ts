import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'

export interface GitHubInstallation {
  id: number
  account: string
  accountType: string
}

export interface GitHubStatus {
  installed: boolean
  connected: boolean
  hasToken: boolean
  installations: GitHubInstallation[]
  repo?: {
    owner: string
    name: string
    fullName: string
    installationId?: number
    lastPushedSha?: string
    lastPushAt?: string
  }
}

interface CreateRepoResult {
  success: boolean
  repo?: { id: number; name: string; full_name: string; default_branch: string; html_url: string }
  error?: string
}

export function useGitHubStatus(projectId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['github-status', projectId],
    queryFn: (): Promise<GitHubStatus> => http.get(`api/projects/${projectId}/github/status`).json(),
    enabled: Boolean(projectId) && (opts?.enabled ?? true),
    staleTime: 30_000,
  })
}

export function useGitHubInstallUrl(projectId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['github-install-url', projectId],
    queryFn: (): Promise<{ url: string }> => http.get(`api/projects/${projectId}/github/install-url`).json(),
    enabled: Boolean(projectId) && (opts?.enabled ?? true),
    staleTime: 60_000,
  })
}

export function useGitHubDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => http.post(`api/projects/${projectId}/github/disconnect`).json(),
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: ['github-status', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useGitHubCreateRepo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      projectId: string
      name: string
      description?: string
      private?: boolean
      installationId?: number
    }): Promise<CreateRepoResult> =>
      http
        .post(`api/projects/${vars.projectId}/github/create-repo`, {
          json: {
            name: vars.name,
            description: vars.description,
            private: vars.private,
            installationId: vars.installationId,
          },
        })
        .json(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['github-status', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['project', vars.projectId] })
    },
  })
}
