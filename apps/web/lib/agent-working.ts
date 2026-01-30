'use client'

import type { Part } from '@opencode-ai/sdk'
/**
 * Infer working state from parts only.
 * Use this only when status is unavailable (initial load / resync).
 */
export function computeWorkingFromParts(parts: Part[]): boolean {
  return parts.some(
    (p) =>
      (p.type === 'tool' && (p.state.status === 'running' || p.state.status === 'pending')) ||
      (p.type === 'reasoning' && !p.time?.end),
  )
}
