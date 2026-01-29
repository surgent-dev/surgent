'use client'

import type { FileDiff } from '@opencode-ai/sdk'
import { useSandbox } from '@/hooks/use-sandbox'

type Props = {
  messageId: string
  sessionId?: string
  diffs?: FileDiff[]
  fileCount: number
}

export default function MessageDiffBadge({ messageId, sessionId, diffs, fileCount }: Props) {
  const openChangesTab = useSandbox((s) => s.openChangesTab)

  if (fileCount === 0) return null

  return (
    <button
      onClick={() => openChangesTab?.(messageId, sessionId, diffs)}
      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {fileCount} file{fileCount !== 1 ? 's' : ''} changed
    </button>
  )
}
