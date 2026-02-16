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

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

export function buildBashCommand(cwd: string, script: string): string {
  return `bash -lc '${['set -euo pipefail', `cd ${shellQuote(cwd)}`, script].join('\n').replace(/'/g, "'\"'\"'")}'`
}

export function validateProcessName(name: string): void {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(name)) {
    throw new Error(`Invalid process name: must match ^[a-zA-Z0-9._-]{1,64}$`)
  }
}

export function validateDevScript(command: string): void {
  const safe = /^(bun(x)?|npm|pnpm|yarn)\s+(run\s+)?[a-zA-Z0-9_:.-]+(\s+--[a-zA-Z0-9_=-]*)*$/
  if (!safe.test(command.trim())) {
    throw new Error(`Invalid dev script: only package manager run commands allowed`)
  }
}
