'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { FileDiff } from '@opencode-ai/sdk'
import Conversation from './conversation'
import PreviewPanel, { type PreviewTab } from './preview-panel'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useActivateProject } from '@/queries/projects'
import { useSandbox } from '@/hooks/use-sandbox'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSandboxReady } from '@/hooks/use-sandbox-ready'
import ProjectHeader from './project-header'
import { ProjectInitOverlay } from './project-init-overlay'
import { ProjectEventProvider } from '@/context/project-events'

interface SplitViewProps {
  projectId?: string
  onPreviewUrl?: (url: string | null) => void
  initialPrompt?: string
}

export default function SplitView({ projectId, onPreviewUrl, initialPrompt }: SplitViewProps) {
  const { mutate: activateProject } = useActivateProject()
  const { isReady, stage, project } = useSandboxReady(projectId)

  const setSandboxId = useSandbox((state: any) => state.setSandboxId)
  const activeSessionId = useSandbox((s) => (projectId ? s.activeSessionId[projectId] : undefined))
  const lastActivatedId = useRef<string | undefined>(undefined)
  const isMobile = useIsMobile()

  const convexDeployments = (
    project?.integrations?.find((i) => i.provider === 'convex')?.config as any
  )?.deployments
  const hasConvexDev = Boolean(convexDeployments?.development?.name)
  const hasConvexProd = Boolean(convexDeployments?.production?.name)
  const convexTabsAdded = useRef(false)

  const [tabs, setTabs] = useState<PreviewTab[]>([
    { id: 'preview', type: 'preview', title: 'Preview' },
    { id: 'payments', type: 'payments', title: 'Payments' },
  ])
  const [activeTabId, setActiveTabId] = useState('preview')
  const tabCounter = useRef(0)

  // Add single Convex database tab after Preview tab
  useEffect(() => {
    if (convexTabsAdded.current || (!hasConvexDev && !hasConvexProd)) return
    convexTabsAdded.current = true

    const envs: ('development' | 'production')[] = []
    if (hasConvexDev) envs.push('development')
    if (hasConvexProd) envs.push('production')

    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === 'preview') + 1
      return [
        ...prev.slice(0, idx),
        {
          id: 'convex',
          type: 'convex' as const,
          title: 'Database',
          convexEnv: envs[0],
          convexEnvs: envs,
        },
        ...prev.slice(idx),
      ]
    })
  }, [hasConvexDev, hasConvexProd])

  const handleConvexEnvChange = useCallback((env: 'development' | 'production') => {
    setTabs((prev) => prev.map((t) => (t.type === 'convex' ? { ...t, convexEnv: env } : t)))
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((t) => t.filter((tab) => tab.id !== tabId))
    setActiveTabId((prev) => (prev === tabId ? 'preview' : prev))
  }, [])

  const handleAddTab = useCallback((type: PreviewTab['type']) => {
    setTabs((prev) => {
      if (type !== 'logs' && type !== 'payments') return prev
      if (prev.some((tab) => tab.type === type)) return prev
      tabCounter.current += 1
      const title = type === 'logs' ? 'Server Logs' : 'Payments'
      const id = `${type}-${tabCounter.current}`
      return [...prev, { id, type, title }]
    })
  }, [])

  const handleOpenChangesTab = useCallback(
    (messageId?: string, sessionId?: string, diffs?: FileDiff[]) => {
      const sid = sessionId || activeSessionId
      const id = messageId
        ? `changes-${messageId}`
        : sid
          ? `changes-session-${sid}`
          : 'changes-session'
      const title = messageId ? 'Changes' : 'Session Changes'
      setTabs((prev) => {
        const existing = prev.findIndex((t) => t.id === id)
        const nextTab = { id, type: 'changes' as const, title, messageId, sessionId: sid, diffs }
        if (existing !== -1) {
          const next = [...prev]
          next[existing] = { ...prev[existing]!, ...nextTab }
          return next
        }
        return [...prev, nextTab]
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

  // Activate project sandbox on mount (skip if provisioning or failed)
  const canActivate = !!project && project.status !== 'provisioning' && project.status !== 'failed'
  useEffect(() => {
    if (!projectId || !canActivate) return
    if (lastActivatedId.current === projectId) return

    lastActivatedId.current = projectId
    activateProject({ id: projectId })
  }, [projectId, canActivate, activateProject])

  // Set sandbox ID when project data loads
  useEffect(() => {
    setSandboxId(project?.sandbox?.id || null)
  }, [project, setSandboxId])

  return (
    <div className="h-dvh w-full bg-background flex flex-col overflow-hidden">
      <ProjectInitOverlay
        show={!isReady}
        stage={stage}
        provisioningStep={project?.metadata?.provisioningStep}
      />
      <ProjectHeader projectId={projectId} project={project} />
      <div className="flex-1 min-h-0 min-w-0">
        {isReady ? (
          <ProjectEventProvider key={projectId} projectId={projectId}>
            {isMobile ? (
              <div className="h-full min-h-0 min-w-0 flex flex-col">
                <Tabs defaultValue="chat" className="h-full min-h-0 flex flex-col">
                  <div className="px-2 pt-2 pb-1.5">
                    <TabsList className="w-full max-w-sm mx-auto h-9 p-0.5!">
                      <TabsTrigger
                        value="chat"
                        className="cursor-pointer select-none px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        Conversation
                      </TabsTrigger>
                      <TabsTrigger
                        value="preview"
                        className="cursor-pointer select-none px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="chat" className="flex-1 min-h-0 min-w-0 flex flex-col">
                    <div className="flex-1 min-h-0 min-w-0 px-1 pb-1">
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
                          onConvexEnvChange={handleConvexEnvChange}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="h-full min-h-0 min-w-0">
                <ResizablePanelGroup direction="horizontal" className="h-full !overflow-visible">
                  <ResizablePanel defaultSize={40} minSize={30}>
                    <Conversation projectId={projectId} initialPrompt={initialPrompt} />
                  </ResizablePanel>
                  <ResizableHandle className="bg-transparent" />
                  <ResizablePanel
                    defaultSize={60}
                    minSize={30}
                    className="!overflow-visible rounded-tl-xl"
                  >
                    <div className="h-full bg-background border-l border-t rounded-tl-xl overflow-hidden">
                      <PreviewPanel
                        projectId={projectId}
                        project={project}
                        onPreviewUrl={onPreviewUrl}
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onTabChange={setActiveTabId}
                        onCloseTab={handleCloseTab}
                        onAddTab={handleAddTab}
                        onConvexEnvChange={handleConvexEnvChange}
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}
          </ProjectEventProvider>
        ) : null}
      </div>
    </div>
  )
}
