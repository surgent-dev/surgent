import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";

// Types
export interface GitHubInstallation {
  id: number;
  account: string;
  accountType: string;
}

export interface GitHubStatus {
  installed: boolean;
  connected: boolean;
  oauthLinked?: boolean;
  installation?: GitHubInstallation;
  installations?: GitHubInstallation[];
  repo?: {
    owner: string;
    name: string;
    fullName: string;
    lastPushedSha?: string;
    lastPushAt?: string;
  };
}

// API functions
async function fetchGitHubStatus(projectId: string): Promise<GitHubStatus> {
  return http.get(`api/projects/${projectId}/github/status`).json();
}

async function fetchGitHubInstallUrl(projectId: string): Promise<{ url: string }> {
  return http.get(`api/projects/${projectId}/github/install-url`).json();
}

async function disconnectGitHubRepo(projectId: string): Promise<{ disconnected: boolean }> {
  return http.post(`api/projects/${projectId}/github/disconnect`).json();
}

async function pushToGitHub(projectId: string): Promise<{ success: boolean; sha?: string; error?: string }> {
  return http.post(`api/projects/${projectId}/github/push`).json();
}

async function createGitHubRepo(
  projectId: string,
  data: {
    name: string;
    description?: string;
    private?: boolean;
    installationId?: number;
  },
): Promise<{
  success: boolean;
  repo?: {
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    html_url: string;
  };
  error?: string;
}> {
  return http.post(`api/projects/${projectId}/github/create-repo`, { json: data }).json();
}

// Hooks
export function useGitHubStatus(projectId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["github-status", projectId],
    queryFn: () => fetchGitHubStatus(projectId!),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useGitHubInstallUrl(projectId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["github-install-url", projectId],
    queryFn: () => fetchGitHubInstallUrl(projectId!),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useGitHubDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => disconnectGitHubRepo(projectId),
    onSuccess: (_res, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["github-status", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useGitHubPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => pushToGitHub(projectId),
    onSuccess: (_res, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["github-status", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useGitHubCreateRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      description,
      private: isPrivate,
      installationId,
    }: {
      projectId: string;
      name: string;
      description?: string;
      private?: boolean;
      installationId?: number;
    }) =>
      createGitHubRepo(projectId, {
        name,
        description,
        private: isPrivate,
        installationId,
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["github-status", vars.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}
