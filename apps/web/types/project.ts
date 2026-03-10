import type {
  ProjectProvisioningMetadata,
  ProjectProvisioningStep,
} from '@/lib/project-provisioning'

export interface Sandbox {
  id: string
  status: string | null
  url: string | null
}

export interface Worker {
  name: string
  status: string | null
  hostname: string | null
}

export type ProjectStatus = 'provisioning' | 'ready' | 'failed'

export interface ProjectMetadata {
  workingDirectory?: string
  processName?: string
  startCommand?: string
  provisioningStep?: ProjectProvisioningStep | null
  provisioning?: ProjectProvisioningMetadata
}

export interface Project {
  id: string
  userId: string
  organizationId?: string
  name: string
  status: ProjectStatus
  failReason?: string | null
  github: any | null
  settings: any | null
  metadata: ProjectMetadata | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  sandbox: Sandbox | null
  worker: Worker | null
}
