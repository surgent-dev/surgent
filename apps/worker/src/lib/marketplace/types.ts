import type { EnvDestination, FulfillmentMetadata } from '@repo/db'

export type { FulfillmentMetadata }

export type FulfillmentStep =
  | 'creating_project'
  | 'provisioning_sandbox'
  | 'restoring_codebase'
  | 'provisioning_integrations'
  | 'setting_env_vars'
  | 'starting_dev_server'
  | 'finalizing'

export interface FulfillmentJobData {
  purchaseId: string
}

export interface SnapshotJobData {
  listingId: string
  projectId: string
}

export type EnvClassification = 're-provision' | 're-generate' | 'copy' | 'skip'

export interface EnvRule {
  key: string
  classification: EnvClassification
}

export interface ProvisionContext {
  projectId: string
  buyerId: string
  sourceProjectId: string
  sandbox: Sandbox
  workDir: string
}

export interface ProvisionResult {
  integrationId: string
  envVars: Record<string, { value: string; destination: EnvDestination }>
}

import type { Sandbox } from '@/apis/sandbox'
export type { Sandbox }
