export interface AdminOpsAlert {
  type: 'dlq' | 'stuck_provisioning' | 'stuck_deployment' | 'queue_error'
  severity: 'critical' | 'warning'
  title: string
  message: string
  queue?: string
  count?: number
}

export interface AdminOpsProjectItem {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  userEmail: string
  provisioningStep?: string | null
  error: string | null
  ageMinutes: number
}

export interface AdminOpsDeploymentActiveItem {
  id: string
  projectId: string
  projectName: string
  userEmail: string
  status: string
  startedAt: string
  hostname: string | null
  scriptName: string
  ageMinutes: number
  isStuck: boolean
}

export interface AdminOpsDeploymentFailureItem {
  id: string
  projectId: string
  projectName: string
  userEmail: string
  status: string
  startedAt: string | null
  finishedAt: string
  hostname: string | null
  scriptName: string
  error: string | null
}

export interface AdminOpsQueueItem {
  name: string
  category: string
  label: string
  purpose: string
  isDeadLetter: boolean
  policy: string | null
  createdReady: number
  deferred: number
  retry: number
  active: number
  failed: number
  cancelled: number
  completed: number
  total: number
  blockedKeyCount: number
  blockedKeys: string[]
  error: string | null
}

export interface AdminOpsData {
  generatedAt: string
  range: string
  start: string
  thresholds: {
    stuckProvisioningMinutes: number
    stuckDeploymentMinutes: number
  }
  alerts: AdminOpsAlert[]
  problems: {
    summary: {
      projectFailures: number
      deploymentFailures: number
      dlqJobs: number
    }
  }
  projects: {
    summary: {
      provisioning: number
      ready: number
      failed: number
      stuckProvisioning: number
    }
    stuck: AdminOpsProjectItem[]
    recentFailures: AdminOpsProjectItem[]
  }
  deployments: {
    summary: {
      queued: number
      active: number
      deployed: number
      buildFailed: number
      deployFailed: number
      cancelled: number
      stuckActive: number
    }
    active: AdminOpsDeploymentActiveItem[]
    recentFailures: AdminOpsDeploymentFailureItem[]
  }
  queues: {
    summary: {
      dlqJobs: number
      retryingJobs: number
      activeJobs: number
    }
    items: AdminOpsQueueItem[]
  }
}
