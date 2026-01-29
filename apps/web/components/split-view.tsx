'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { FileDiff } from '@opencode-ai/sdk'
import Conversation from './conversation'
import PreviewPanel, { type PreviewTab } from './preview-panel'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useActivateProject, useProjectQuery } from '@/queries/projects'
import { useSandbox } from '@/hooks/use-sandbox'
import { useIsMobile } from '@/hooks/use-mobile'
import ProjectHeader from './project-header'

interface SplitViewProps {
  projectId?: string
  onPreviewUrl?: (url: string | null) => void
  initialPrompt?: string
}

export default function SplitView({ projectId, onPreviewUrl, initialPrompt }: SplitViewProps) {
  const { mutate: activateProject } = useActivateProject()
  const { data: project } = useProjectQuery(projectId)
  const setSandboxId = useSandbox((state: any) => state.setSandboxId)
  const activeSessionId = useSandbox((s) => (projectId ? s.activeSessionId[projectId] : undefined))
  const lastActivatedId = useRef<string | undefined>(undefined)
  const isMobile = useIsMobile()

  const hasConvex = Boolean((project?.metadata as any)?.convex)
  const convexTabAdded = useRef(false)

  const [tabs, setTabs] = useState<PreviewTab[]>([{ id: 'preview', type: 'preview', title: 'Preview' }])
  const [activeTabId, setActiveTabId] = useState('preview')
  const tabCounter = useRef(0)

  // Add Convex tab once when project has Convex enabled (insert after Preview, before Payments)
  useEffect(() => {
    if (hasConvex && !convexTabAdded.current) {
      convexTabAdded.current = true
      setTabs((prev) => {
        const previewIdx = prev.findIndex((t) => t.id === 'preview')
        const newTab = { id: 'convex', type: 'convex' as const, title: 'Database' }
        const result = [...prev]
        result.splice(previewIdx + 1, 0, newTab)
        return result
      })
    }
  }, [hasConvex])

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((t) => t.filter((tab) => tab.id !== tabId))
    setActiveTabId((prev) => (prev === tabId ? 'preview' : prev))
  }, [])

  const handleAddTab = useCallback((type: PreviewTab['type']) => {
    setTabs((prev) => {
      if (type !== 'mcp' && type !== 'logs') return prev
      if (prev.some((tab) => tab.type === type)) return prev
      tabCounter.current += 1
      const title = type === 'mcp' ? 'MCP' : 'Server Logs'
      const id = `${type}-${tabCounter.current}`
      return [...prev, { id, type, title }]
    })
  }, [])

  const handleOpenChangesTab = useCallback(
    (messageId?: string, sessionId?: string, diffs?: FileDiff[]) => {
      const id = messageId ? `changes-${messageId}` : 'changes-session'
      const sid = sessionId || activeSessionId
      const title = messageId ? 'Changes' : 'Session Changes'
      setTabs((prev) => {
        const existing = prev.findIndex((t) => t.id === id)
        if (existing !== -1) {
          if (!diffs) return prev
          const next = [...prev]
          next[existing] = { ...prev[existing]!, diffs, sessionId: sid }
          return next
        }
        return [...prev, { id, type: 'changes' as const, title, messageId, sessionId: sid, diffs }]
      })
      setActiveTabId(id)
    },
    [activeSessionId],
  )

  const setOpenChangesTab = useSandbox((s) => s.setOpenChangesTab)
  useEffect(() => {
    setOpenChangesTab(handleOpenChangesTab)
    return () => setOpenChangesTab(undefined)
  }, [handleOpenChangesTab, setOpenChangesTab])

  // Activate project sandbox on mount
  useEffect(() => {
    if (!projectId) return
    if (lastActivatedId.current === projectId) return

    lastActivatedId.current = projectId
    activateProject({ id: projectId })
  }, [projectId, activateProject])

  // Set sandbox ID when project data loads
  useEffect(() => {
    setSandboxId(project?.sandbox?.id || null)
  }, [project, setSandboxId])

  return (
    <div className="h-dvh w-full bg-background flex flex-col overflow-hidden">
      <ProjectHeader projectId={projectId} project={project} />
      <div className="flex-1 min-h-0">
        {isMobile ? (
          <div className="h-full min-h-0 flex flex-col">
            <Tabs defaultValue="chat" className="h-full min-h-0 flex flex-col">
              <div className="px-2 pt-2 pb-1.5">
                <TabsList className="w-full max-w-sm mx-auto h-9 p-0.5!">
                  <TabsTrigger value="chat" className="cursor-pointer select-none px-2 sm:px-3 text-xs sm:text-sm">
                    Conversation
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="cursor-pointer select-none px-2 sm:px-3 text-xs sm:text-sm">
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 px-1 pb-1">
                  <Conversation projectId={projectId} initialPrompt={initialPrompt} />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 px-1 pb-1">
                  <div className="h-full min-h-0 overflow-hidden rounded-xl border bg-background">
                    <PreviewPanel
                      projectId={projectId}
                      project={project}
                      onPreviewUrl={onPreviewUrl}
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onTabChange={setActiveTabId}
                      onCloseTab={handleCloseTab}
                      onAddTab={handleAddTab}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="h-full min-h-0">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={40} minSize={30}>
                <Conversation projectId={projectId} initialPrompt={initialPrompt} />
              </ResizablePanel>
              <ResizableHandle className="shadow-2xl" />
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="h-full bg-background">
                  <PreviewPanel
                    projectId={projectId}
                    project={project}
                    onPreviewUrl={onPreviewUrl}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabChange={setActiveTabId}
                    onCloseTab={handleCloseTab}
                    onAddTab={handleAddTab}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </div>
  )
}
