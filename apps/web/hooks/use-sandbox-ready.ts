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
  const shouldCheckHealth = Boolean(project) && !isProvisioning && !isFailed

  const { data: health, isError: isHealthError } = useSandboxHealthQuery(
    projectId,
    shouldCheckHealth,
  )

  const hasSandboxUrl = Boolean(project?.sandbox?.url)
  const isHealthy = health?.status === 'running'
  const isTerminalHealth = health?.status === 'not_found' || health?.status === 'forbidden'
  const isReady = hasSandboxUrl && isHealthy && !isProvisioning && !isFailed && !isError

  let stage: SandboxStage = 'ready'
  if (isLoading) stage = 'loading'
  else if (isError || !project || isFailed || isHealthError || isTerminalHealth) stage = 'failed'
  else if (isProvisioning) stage = 'creating'
  else if (!hasSandboxUrl) stage = 'activating'
  else if (!isHealthy) stage = 'starting'

  return { isReady, stage, project }
}
