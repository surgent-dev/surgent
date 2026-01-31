import { config } from './config'

export function sanitizeHostname(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

/** Generate Surgent proxy URL: https://{port}-{sandboxId}.{previewDomain} */
export function getSandboxPreviewUrl(
  sandboxId?: string | null,
  port = 3000,
  fallback?: string | null,
) {
  const { previewDomain } = config.sandbox
  if (!sandboxId || !previewDomain) return fallback ?? null
  return `https://${port}-${sandboxId}.${previewDomain}`
}
