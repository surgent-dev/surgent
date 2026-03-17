export const DEPLOYMENT_STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  starting: 'Starting',
  deploying_convex: 'Deploying Convex',
  building: 'Building',
  uploading: 'Uploading',
  deployed: 'Deployed',
  build_failed: 'Build failed',
  deploy_failed: 'Deploy failed',
  cancelled: 'Cancelled',
}

export const TERMINAL_DEPLOYMENT_STATUSES = [
  'deployed',
  'deploy_failed',
  'build_failed',
  'cancelled',
]

export function sanitizeDeploymentHostname(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}
