import { useProjectQuery, useSandboxHealthQuery } from '@/queries/projects'

export type SandboxStage = 'creating' | 'loading' | 'activating' | 'starting' | 'ready'

interface UseSandboxReadyResult {
  isReady: boolean
  stage: SandboxStage
  project: ReturnType<typeof useProjectQuery>['data']
}

export function useSandboxReady(projectId: string | undefined): UseSandboxReadyResult {
  const { data: project, isLoading } = useProjectQuery(projectId)
  const { data: health } = useSandboxHealthQuery(projectId)

  const hasSandboxUrl = Boolean(project?.sandbox?.url)
  const isHealthy = health?.status === 'running'
  const isReady = hasSandboxUrl && isHealthy

  // Determine current stage
  const stage: SandboxStage =
    isLoading || !project
      ? 'loading'
      : !hasSandboxUrl
        ? 'activating'
        : !isHealthy
          ? 'starting'
          : 'ready'

  return { isReady, stage, project }
}
