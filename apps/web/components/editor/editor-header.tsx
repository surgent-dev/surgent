'use client'

import Link from 'next/link'
import DownloadButton from '@/components/project-header/download-button'
import GitHubButton from '@/components/project-header/github-button'
import PayDialogs from '@/components/project-header/pay-dialogs'
import PublishButton from '@/components/project-header/publish-button'
import SupportMenu from '@/components/project-header/support-menu'
import { TooltipProvider } from '@/components/ui/tooltip'

interface EditorHeaderProps {
  projectId: string
  project?: {
    name?: string
    isPublic?: boolean
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
}

export default function EditorHeader({ projectId, project }: EditorHeaderProps) {
  return (
    <>
      <header className="flex shrink-0 items-center gap-2 sm:gap-3 rounded-lg bg-white px-2 sm:px-3 py-1.5 dark:bg-card">
        <div className="hidden sm:flex items-center gap-1.5 text-[13px]">
          <Link
            href={`/company/${projectId}`}
            className="text-muted-foreground/35 hover:text-foreground transition-colors"
          >
            Project
          </Link>
          <span className="text-muted-foreground/15">/</span>
          <span className="font-medium text-foreground">Editor</span>
        </div>
        <Link
          href={`/company/${projectId}`}
          className="sm:hidden text-[13px] text-muted-foreground/35 hover:text-foreground transition-colors"
        >
          &larr;
        </Link>

        <div className="flex-1" />

        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5">
            <DownloadButton projectId={projectId} projectName={project?.name} />
            <GitHubButton projectId={projectId} />
            <SupportMenu />
          </div>
        </TooltipProvider>

        <PublishButton projectId={projectId} project={project} />
      </header>

      <PayDialogs projectId={projectId} />
    </>
  )
}
