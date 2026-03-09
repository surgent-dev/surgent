export const PROJECT_PROVISIONING_STEPS = [
  'provisioning_sandbox',
  'installing_dependencies',
  'starting_ai_agent',
  'finalizing',
] as const

export type ProjectProvisioningStep = (typeof PROJECT_PROVISIONING_STEPS)[number]

export interface ProjectProvisioningMetadata {
  sandboxId?: string
  previewUrl?: string
  processName?: string
  startCommand?: string
  initializedAt?: string
  opencodeReadyAt?: string
  finalizedAt?: string
  lastError?: string | null
}

const PROJECT_PROVISIONING_STEP_LABELS: Record<ProjectProvisioningStep, string> = {
  provisioning_sandbox: 'Provisioning sandbox',
  installing_dependencies: 'Installing dependencies',
  starting_ai_agent: 'Starting AI agent',
  finalizing: 'Finalizing',
}

export function getProvisioningStepLabel(
  step?: ProjectProvisioningStep | string | null,
): string | null {
  if (!step) return null
  return PROJECT_PROVISIONING_STEP_LABELS[step as ProjectProvisioningStep] || step
}
