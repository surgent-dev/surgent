import { useProjectQuery, useSandboxHealthQuery } from '@/queries/projects'

export type SandboxStage = 'creating' | 'loading' | 'activating' | 'starting' | 'ready' | 'failed'

interface UseSandboxReadyResult {
  isReady: boolean
  stage: SandboxStage
  project: ReturnType<typeof useProjectQuery>['data']
}

export function useSandboxReady(projectId: string | undefined): UseSandboxReadyResult {
  const { data: project, isError, isLoading } = useProjectQuery(projectId)

  const isProvisioning = project?.status === 'provisioning'
  const isFailed = project?.status === 'failed'

  // Don't poll sandbox health while project is still provisioning or failed
  const { data: health } = useSandboxHealthQuery(
    projectId,
    Boolean(project) && !isProvisioning && !isFailed,
  )

  const hasSandboxUrl = Boolean(project?.sandbox?.url)
  const isHealthy = health?.status === 'running'
  const isReady = hasSandboxUrl && isHealthy && !isProvisioning && !isFailed && !isError

  const stage: SandboxStage = isLoading
    ? 'loading'
    : isError || !project
      ? 'failed'
      : isFailed
        ? 'failed'
        : isProvisioning
          ? 'creating'
          : !hasSandboxUrl
            ? 'activating'
            : !isHealthy
              ? 'starting'
              : 'ready'

  return { isReady, stage, project }
}
