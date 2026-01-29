import type { FileDiff } from '@opencode-ai/sdk'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  setOpenChangesTab: (fn: ((messageId?: string, sessionId?: string, diffs?: FileDiff[]) => void) | undefined) => void
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
    }),
    { name: 'sandbox-store', partialize: (s) => ({ activeSessionId: s.activeSessionId }) },
  ),
)
