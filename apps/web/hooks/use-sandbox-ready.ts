import { useProjectQuery, useSandboxHealthQuery } from '@/queries/projects'

export type ActivationStatus = 'idle' | 'pending' | 'success' | 'error'
export type SandboxStage =
  | 'creating'
  | 'loading'
  | 'activating'
  | 'starting'
  | 'ready'
  | 'failed'
  | 'unavailable'

interface UseSandboxReadyResult {
  isReady: boolean
  stage: SandboxStage
  project: ReturnType<typeof useProjectQuery>['data']
}

export function useSandboxReady(
  projectId: string | undefined,
  activationStatus: ActivationStatus,
): UseSandboxReadyResult {
  const { data: project, isError, isLoading } = useProjectQuery(projectId)

  const isProvisioning = project?.status === 'provisioning'
  const isFailed = project?.status === 'failed'
  const shouldCheckHealth =
    Boolean(project) && !isProvisioning && !isFailed && activationStatus === 'success'

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
  else if (isError || !project) stage = 'unavailable'
  else if (isFailed || activationStatus === 'error' || isHealthError || isTerminalHealth)
    stage = 'failed'
  else if (isProvisioning) stage = 'creating'
  else if (!hasSandboxUrl || activationStatus !== 'success') stage = 'activating'
  else if (!isHealthy) stage = 'starting'

  return { isReady, stage, project }
}
