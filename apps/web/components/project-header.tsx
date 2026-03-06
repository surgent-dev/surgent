'use client'

import { useState, useCallback } from 'react'

import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import {
  ArrowLeft,
  RocketLaunch,
  PencilSimple,
  DownloadSimple,
  GithubLogo,
  Copy,
  DiscordLogo,
  Envelope,
  TelegramLogo,
  Headset,
  Tag,
  CircleNotch,
} from '@phosphor-icons/react'
import { useCredits } from '@/hooks/use-credits'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import PlanDialog from '@/components/plan-dialog'
import { useRenameProject, useLatestDeploymentQuery } from '@/queries/projects'
import { http } from '@/lib/http'
import GitHubDialog from '@/components/github-dialog'
import DeploymentStatusDialog from '@/components/deployment-status-dialog'
import { useGitHubStatus } from '@/queries/github'
import WarningBanner from '@/components/project-header/warning-banner'
import UserMenu from '@/components/project-header/user-menu'
import PayDialogs from '@/components/project-header/pay-dialogs'
import SellDialog from '@/components/project-header/sell-dialog'
import { PublishModal, PreviewButton } from '@/components/publish'

// Types
interface ProjectHeaderProps {
  projectId?: string
  project?: {
    name?: string
    isPublic?: boolean
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
}

export default function ProjectHeader({ projectId, project }: ProjectHeaderProps) {
  const router = useRouter()
  const credits = useCredits()

  // Dialog states
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false)
  const [isDeploymentStatusOpen, setIsDeploymentStatusOpen] = useState(false)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isSellOpen, setIsSellOpen] = useState(false)

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // Loading states
  const [downloading, setDownloading] = useState(false)

  // Queries & mutations
  const renameProject = useRenameProject()
  useGitHubStatus(projectId, { enabled: isGitHubDialogOpen })
  const { data: latestDeployment } = useLatestDeploymentQuery(projectId)

  // Derived state
  const worker = project?.worker
  const workerName = worker?.name
  const workerStatus = worker?.status ?? ''
  const isDeployed = workerStatus === 'active'
  const isFailed = workerStatus === 'error'

  // Handlers
  const handleStartEdit = () => {
    setEditName(project?.name || '')
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    const trimmed = editName.trim()
    if (!projectId || !trimmed || trimmed === project?.name) {
      setIsEditing(false)
      return
    }
    renameProject.mutate(
      { id: projectId, name: trimmed },
      {
        onSuccess: () => setIsEditing(false),
        onError: () => toast.error('Failed to rename', { position: 'top-right' }),
      },
    )
  }

  const handleDownload = useCallback(async () => {
    if (!projectId || downloading) return
    setDownloading(true)
    try {
      const response = await http.get(`api/projects/${projectId}/download`, { timeout: 120000 })
      if (response.status === 402) {
        credits.setPlanDialogOpen(true)
        return
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] || `${project?.name || 'project'}.tar.gz`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed', { position: 'top-right' })
    } finally {
      setDownloading(false)
    }
  }, [projectId, downloading, project?.name, credits])

  return (
    <>
      <WarningBanner onDownload={handleDownload} downloading={downloading} />

      <header className="h-11 flex items-center bg-background shrink-0 pl-3 pr-4">
        {/* Back */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-4" />
        </Button>

        {/* Logo + Brand */}
        <button
          onClick={() => router.push('/dashboard')}
          className="hidden sm:flex items-center gap-2 px-3 hover:bg-muted/30 rounded-md transition-colors"
        >
          <Image src="/surgent-coin.svg" alt="Surgent" width={20} height={20} className="size-5" />
          <span className="text-[13px] font-medium">Surgent</span>
        </button>

        {/* Project name */}
        {isEditing ? (
          <div className="flex items-center px-2.5 sm:px-4">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              className="h-7 px-2.5 text-[13px] font-medium rounded-md border border-border/60 bg-muted/30 outline-none focus:border-foreground/15 w-28 sm:w-44 transition-all duration-100"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="group flex items-center gap-1.5 px-2.5 sm:px-4 text-[13px] font-medium hover:bg-muted/30 rounded-md min-w-0 transition-colors"
          >
            <span className="truncate max-w-[100px] sm:max-w-none">
              {project?.name || 'Untitled'}
            </span>
            <PencilSimple className="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
          </button>
        )}

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pr-2">
          {/* Download */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleDownload}
                disabled={downloading || !projectId}
                aria-label="Download project"
              >
                {downloading ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <DownloadSimple className="size-4" weight="bold" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download project</TooltipContent>
          </Tooltip>

          {/* GitHub */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsGitHubDialogOpen(true)}
                disabled={!projectId}
                aria-label="Push to GitHub"
              >
                <GithubLogo className="size-4" weight="bold" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Push to GitHub</TooltipContent>
          </Tooltip>

          {/* Support */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Support">
                <span className="relative">
                  <Headset className="size-4" weight="bold" />
                  <span className="absolute -top-0.5 -right-0.5 size-1.5 bg-green-500 rounded-full" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="w-52 rounded-lg border-border/40 p-1 shadow-[0_8px_16px_-4px_#00000014,0_4px_6px_-2px_#0000000a,0_0_0_1px_#0000000f]"
            >
              <div className="px-3.5 py-2.5 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                  </span>
                  <span className="text-[13px] font-medium">We&apos;re online</span>
                </div>
              </div>
              <DropdownMenuItem
                className="gap-2 rounded-md px-2 py-2 text-[12px] cursor-pointer"
                onClick={() => navigator.clipboard.writeText('ben@surgent.dev')}
              >
                <Envelope className="size-3.5 text-muted-foreground/70" weight="duotone" />
                <span className="flex-1 truncate text-[12px]">ben@surgent.dev</span>
                <Copy className="size-3 text-muted-foreground/40" weight="bold" />
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="gap-2 rounded-md px-2 py-2 text-[12px] cursor-pointer"
              >
                <a href="https://discord.gg/DRWbFEtY" target="_blank" rel="noopener noreferrer">
                  <DiscordLogo className="size-3.5 text-[#5865F2]" weight="fill" />
                  <span className="flex-1 text-[12px]">Discord</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="gap-2 rounded-md px-2 py-2 text-[12px] cursor-pointer"
              >
                <a href="https://t.me/bensurgent" target="_blank" rel="noopener noreferrer">
                  <TelegramLogo className="size-3.5 text-[#26A5E4]" weight="fill" />
                  <span className="flex-1 text-[12px]">Telegram</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sell */}
          <Button
            variant="default"
            disabled={!projectId}
            aria-label="List on marketplace"
            onClick={() => {
              if (!projectId) return
              if (!workerName) {
                toast('Publish your app first before listing', {
                  icon: '\uD83D\uDE80',
                  position: 'top-right',
                })
                return
              }
              setIsSellOpen(true)
            }}
          >
            <Tag className="size-4" weight="fill" />
            <span className="hidden sm:inline">Sell</span>
          </Button>

          {/* Preview */}
          <PreviewButton />

          {/* Publish */}
          <Button
            variant="brand"
            disabled={!projectId}
            aria-label="Publish project"
            onClick={() => setIsPublishOpen(true)}
            className="relative"
          >
            <RocketLaunch className="size-4" weight="fill" />
            <span className="hidden sm:inline">{workerName ? 'Republish' : 'Publish'}</span>
            {(isDeployed || isFailed) && (
              <span
                className={`absolute -top-0.5 -right-0.5 size-2 rounded-full border border-background ${
                  isDeployed ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
            )}
          </Button>
        </div>

        <UserMenu onUpgrade={() => credits.setPlanDialogOpen(true)} />
      </header>

      {/* Dialogs */}
      <GitHubDialog
        open={isGitHubDialogOpen}
        onOpenChange={setIsGitHubDialogOpen}
        projectId={projectId}
      />
      <PublishModal
        open={isPublishOpen}
        onOpenChange={setIsPublishOpen}
        projectId={projectId}
        project={project}
        onOpenHistory={() => setIsDeploymentStatusOpen(true)}
      />
      <DeploymentStatusDialog
        open={isDeploymentStatusOpen}
        onOpenChange={setIsDeploymentStatusOpen}
        projectId={projectId}
        worker={worker}
      />
      <PayDialogs projectId={projectId} />
      <SellDialog
        open={isSellOpen}
        onOpenChange={setIsSellOpen}
        projectId={projectId}
        projectName={project?.name}
        screenshotUrl={latestDeployment?.screenshotUrl}
      />
      <PlanDialog open={credits.planDialogOpen} onOpenChange={credits.setPlanDialogOpen} />
    </>
  )
}
