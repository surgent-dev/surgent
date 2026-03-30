import type { ProvisionContext, ProvisionResult } from './types'

export interface IntegrationProvisioner {
  provider: string
  canAutoProvision: boolean
  provision(ctx: ProvisionContext): Promise<ProvisionResult>
}

const registry = new Map<string, IntegrationProvisioner>()

export function registerProvisioner(provisioner: IntegrationProvisioner): void {
  registry.set(provisioner.provider, provisioner)
}

export function getProvisioner(provider: string): IntegrationProvisioner | null {
  return registry.get(provider) || null
}

export function listProvisioners(): IntegrationProvisioner[] {
  return Array.from(registry.values())
}
