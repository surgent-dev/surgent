import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  pushed: boolean
}

export interface GitLogResult {
  initialized: boolean
  commits: GitCommit[]
  branch: string
  ahead: number
  behind: number
}

export interface GitStatusResult {
  initialized: boolean
  branch?: string
  clean?: boolean
  modified?: string[]
  untracked?: string[]
}

interface GitOpResult {
  success: boolean
  sha?: string
  error?: string
}

export function useGitLog(projectId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['git-log', projectId],
    queryFn: (): Promise<GitLogResult> => http.get(`api/projects/${projectId}/git/log`).json(),
    enabled: Boolean(projectId) && (opts?.enabled ?? true),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useGitStatus(projectId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['git-status', projectId],
    queryFn: (): Promise<GitStatusResult> => http.get(`api/projects/${projectId}/git/status`).json(),
    enabled: Boolean(projectId) && (opts?.enabled ?? true),
    staleTime: 10_000,
  })
}

export function useGitPush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string): Promise<GitOpResult> => http.post(`api/projects/${projectId}/git/push`).json(),
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: ['git-log', projectId] })
      qc.invalidateQueries({ queryKey: ['git-status', projectId] })
      qc.invalidateQueries({ queryKey: ['github-status', projectId] })
    },
  })
}

export function useGitPull() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string): Promise<GitOpResult> => http.post(`api/projects/${projectId}/git/pull`).json(),
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: ['git-log', projectId] })
      qc.invalidateQueries({ queryKey: ['git-status', projectId] })
      qc.invalidateQueries({ queryKey: ['github-status', projectId] })
    },
  })
}

export function useGitCommit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, message }: { projectId: string; message: string }): Promise<GitOpResult> =>
      http.post(`api/projects/${projectId}/git/commit`, { json: { message } }).json(),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['git-log', projectId] })
      qc.invalidateQueries({ queryKey: ['git-status', projectId] })
    },
  })
}
