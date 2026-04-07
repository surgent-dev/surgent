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
import { useIsMobile } from '@/hooks/use-mobile'
import { useSandbox } from '@/hooks/use-sandbox'
import { useSandboxReady } from '@/hooks/use-sandbox-ready'
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

  const editorContent = isReady ? <EditorTabs projectId={projectId} project={project} /> : null
  const chatContent = isReady ? (
    <Conversation projectId={projectId} initialPrompt={initialPrompt} />
  ) : null
  const panelClass =
    'h-full min-h-0 overflow-hidden rounded-lg border border-border/40 bg-background dark:bg-card'
  const mobileToggleClass =
    'flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors'

  const editorBody = (
    <div className="flex h-full flex-col gap-1 md:gap-1.5">
      <EditorHeader projectId={projectId} project={project} />

      {isMobile ? (
        <>
          {/* Mobile panel toggle */}
          <div className="flex shrink-0 gap-1 px-1">
            <button
              onClick={() => setMobilePanel('editor')}
              className={cn(
                mobileToggleClass,
                mobilePanel === 'editor'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/40 bg-background text-muted-foreground hover:text-foreground dark:bg-card',
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
                mobileToggleClass,
                mobilePanel === 'chat'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/40 bg-background text-muted-foreground hover:text-foreground dark:bg-card',
              )}
            >
              <Chat className="size-3.5" weight={mobilePanel === 'chat' ? 'fill' : 'regular'} />
              Chat
            </button>
          </div>

          {/* Mobile: single panel at a time */}
          <div className="min-h-0 flex-1">
            {mobilePanel === 'editor' ? (
              <div className={panelClass}>{editorContent}</div>
            ) : (
              <div className={panelClass}>{chatContent}</div>
            )}
          </div>
        </>
      ) : (
        /* Desktop: resizable side-by-side */
        <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={65} minSize={35}>
            <div className={panelClass}>{editorContent}</div>
          </ResizablePanel>

          <ResizableHandle className="mx-0.5 w-px bg-transparent after:w-2 hover:bg-border/50 transition-colors" />

          <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
            <div className={panelClass}>{chatContent}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )

  return (
    <>
      <ProjectInitOverlay
        show={!isReady}
        stage={stage}
        provisioningStep={project?.metadata?.provisioningStep}
      />
      {isReady ? (
        <ProjectEventProvider key={projectId} projectId={projectId}>
          {editorBody}
        </ProjectEventProvider>
      ) : (
        editorBody
      )}
    </>
  )
}
