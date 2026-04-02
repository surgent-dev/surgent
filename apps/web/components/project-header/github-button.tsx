'use client'

import { GithubLogo } from '@phosphor-icons/react'
import { useState } from 'react'
import GitHubDialog from '@/components/github-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface GitHubButtonProps {
  projectId?: string
}

export default function GitHubButton({ projectId }: GitHubButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            disabled={!projectId}
          >
            <GithubLogo className="size-4" weight="bold" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Push to GitHub</TooltipContent>
      </Tooltip>
      <GitHubDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  )
}
