'use client'

import { Gift, Lightning } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import PlanDialog from '@/components/plan-dialog'
import DownloadButton from '@/components/project-header/download-button'
import GitHubButton from '@/components/project-header/github-button'
import PayDialogs from '@/components/project-header/pay-dialogs'
import PublishButton from '@/components/project-header/publish-button'
import SupportMenu from '@/components/project-header/support-menu'
import ReferralDialog from '@/components/referral-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'

interface EditorHeaderProps {
  projectId: string
  project?: {
    name?: string
    isPublic?: boolean
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
}

export default function EditorHeader({ projectId, project }: EditorHeaderProps) {
  const [referralOpen, setReferralOpen] = useState(false)
  const credits = useCredits()
  const isFree = credits.snapshot?.tier !== 'pro'

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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setReferralOpen(true)}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                >
                  <Gift className="size-3.5 gift-wiggle" weight="duotone" />
                  <span className="text-[12px] font-medium hidden sm:inline">Get credits</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Invite friends, earn $5</TooltipContent>
            </Tooltip>
            <DownloadButton projectId={projectId} projectName={project?.name} />
            <GitHubButton projectId={projectId} />
            <SupportMenu />
          </div>

          {isFree && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="brand-violet"
                  size="sm"
                  onClick={() => credits.setPlanDialogOpen(true)}
                >
                  <Lightning className="size-3.5" weight="fill" />
                  <span className="hidden sm:inline">Upgrade</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upgrade to Pro</TooltipContent>
            </Tooltip>
          )}

          <PublishButton projectId={projectId} project={project} />
        </TooltipProvider>
      </header>

      <PayDialogs projectId={projectId} />
      <ReferralDialog open={referralOpen} onOpenChange={setReferralOpen} />
      <PlanDialog open={credits.planDialogOpen} onOpenChange={credits.setPlanDialogOpen} />
    </>
  )
}
