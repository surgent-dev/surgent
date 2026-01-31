import type { FileDiff } from '@opencode-ai/sdk'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type IframeError = {
  message: string
  stack?: string
  url: string
  timestamp: string
  source: 'global' | 'promise' | 'react' | 'react-router'
}

type SandboxState = {
  sandboxId?: string | null
  setSandboxId: (id: string | null | undefined) => void
  // Per-project active session
  activeSessionId: Record<string, string>
  setActiveSession: (projectId: string, sessionId: string) => void
  pulsePaymentsTab: boolean
  setPulsePaymentsTab: (pulse: boolean) => void
  // Callback to open changes tab (set by SplitView)
  openChangesTab?: (messageId?: string, sessionId?: string, diffs?: FileDiff[]) => void
  setOpenChangesTab: (
    fn: ((messageId?: string, sessionId?: string, diffs?: FileDiff[]) => void) | undefined,
  ) => void
  // Iframe error from preview
  iframeError: IframeError | null
  setIframeError: (error: IframeError | null) => void
  // Prompt to inject into chat input (e.g., for "Fix with AI")
  pendingPrompt: string | null
  setPendingPrompt: (prompt: string | null) => void
}

export const useSandbox = create<SandboxState>()(
  persist(
    (set) => ({
      sandboxId: null,
      setSandboxId: (id) => set({ sandboxId: id ?? null }),
      activeSessionId: {},
      setActiveSession: (projectId, sessionId) =>
        set((s) => ({ activeSessionId: { ...s.activeSessionId, [projectId]: sessionId } })),
      pulsePaymentsTab: false,
      setPulsePaymentsTab: (pulse) => set({ pulsePaymentsTab: pulse }),
      openChangesTab: undefined,
      setOpenChangesTab: (fn) => set({ openChangesTab: fn }),
      iframeError: null,
      setIframeError: (error) => set({ iframeError: error }),
      pendingPrompt: null,
      setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
    }),
    { name: 'sandbox-store', partialize: (s) => ({ activeSessionId: s.activeSessionId }) },
  ),
)
