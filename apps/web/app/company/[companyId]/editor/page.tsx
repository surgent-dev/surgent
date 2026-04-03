'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import Conversation from '@/components/conversation'
import EditorHeader from '@/components/editor/editor-header'
import EditorTabs from '@/components/editor/editor-tabs'
import { ProjectInitOverlay } from '@/components/project-init-overlay'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ProjectEventProvider } from '@/context/project-events'
import { useSandbox } from '@/hooks/use-sandbox'
import { useSandboxReady } from '@/hooks/use-sandbox-ready'
import { useActivateProject } from '@/queries/projects'

export default function EditorPage() {
  const { companyId: projectId } = useParams<{ companyId: string }>()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('initial') || undefined
  const { isReady, stage, project } = useSandboxReady(projectId)
  const { mutate: activateProject } = useActivateProject()
  const setSandboxId = useSandbox((s) => s.setSandboxId)
  const activated = useRef(false)

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

  return (
    <ProjectEventProvider key={projectId} projectId={projectId}>
      <ProjectInitOverlay
        show={!isReady}
        stage={stage}
        provisioningStep={project?.metadata?.provisioningStep}
      />
      <div className="flex h-full flex-col gap-1.5">
        <EditorHeader projectId={projectId} project={project} />

        <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={65} minSize={35}>
            <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-card">
              <EditorTabs projectId={projectId} project={project} />
            </div>
          </ResizablePanel>

          <ResizableHandle className="mx-0.5 w-px bg-transparent after:w-2 hover:bg-border/50 transition-colors" />

          <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
            <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-card">
              <Conversation projectId={projectId} initialPrompt={initialPrompt} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ProjectEventProvider>
  )
}
