'use client'

import { Chat, Monitor } from '@phosphor-icons/react'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Conversation from '@/components/conversation'
import EditorHeader from '@/components/editor/editor-header'
import EditorTabs from '@/components/editor/editor-tabs'
import { ProjectInitOverlay } from '@/components/project-init-overlay'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ProjectEventProvider } from '@/context/project-events'
import { useSandbox } from '@/hooks/use-sandbox'
import { useSandboxReady } from '@/hooks/use-sandbox-ready'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useActivateProject } from '@/queries/projects'

export default function EditorPage() {
  const { companyId: projectId } = useParams<{ companyId: string }>()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('initial') || undefined
  const { isReady, stage, project } = useSandboxReady(projectId)
  const { mutate: activateProject } = useActivateProject()
  const setSandboxId = useSandbox((s) => s.setSandboxId)
  const activated = useRef(false)
  const isMobile = useIsMobile()
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'chat'>('editor')

  useEffect(() => setSandboxId(project?.sandbox?.id || null), [project, setSandboxId])

  useEffect(() => {
    if (
      !project ||
      project.status === 'provisioning' ||
      project.status === 'failed' ||
      activated.current
    )
      return
    activated.current = true
    activateProject({ id: projectId })
  }, [activateProject, project, projectId])

  const editorContent = <EditorTabs projectId={projectId} project={project} />
  const chatContent = <Conversation projectId={projectId} initialPrompt={initialPrompt} />

  return (
    <ProjectEventProvider key={projectId} projectId={projectId}>
      <ProjectInitOverlay
        show={!isReady}
        stage={stage}
        provisioningStep={project?.metadata?.provisioningStep}
      />
      <div className="flex h-full flex-col gap-1 md:gap-1.5">
        <EditorHeader projectId={projectId} project={project} />

        {isMobile ? (
          <>
            {/* Mobile panel toggle */}
            <div className="flex shrink-0 gap-1 px-1">
              <button
                onClick={() => setMobilePanel('editor')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                  mobilePanel === 'editor'
                    ? 'bg-foreground text-background'
                    : 'bg-white dark:bg-card text-muted-foreground',
                )}
              >
                <Monitor
                  className="size-3.5"
                  weight={mobilePanel === 'editor' ? 'fill' : 'regular'}
                />
                Preview
              </button>
              <button
                onClick={() => setMobilePanel('chat')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                  mobilePanel === 'chat'
                    ? 'bg-foreground text-background'
                    : 'bg-white dark:bg-card text-muted-foreground',
                )}
              >
                <Chat className="size-3.5" weight={mobilePanel === 'chat' ? 'fill' : 'regular'} />
                Chat
              </button>
            </div>

            {/* Mobile: single panel at a time */}
            <div className="min-h-0 flex-1">
              {mobilePanel === 'editor' ? (
                <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-card">
                  {editorContent}
                </div>
              ) : (
                <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-card">
                  {chatContent}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Desktop: resizable side-by-side */
          <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize={65} minSize={35}>
              <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-card">
                {editorContent}
              </div>
            </ResizablePanel>

            <ResizableHandle className="mx-0.5 w-px bg-transparent after:w-2 hover:bg-border/50 transition-colors" />

            <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
              <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-card">
                {chatContent}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </ProjectEventProvider>
  )
}
