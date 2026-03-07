'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import {
  ArrowLeft,
  RocketLaunch,
  PencilSimple,
  DownloadSimple,
  X,
  GithubLogo,
  CaretDown,
  Copy,
  Clock,
  ArrowSquareOut,
  DiscordLogo,
  Envelope,
  TelegramLogo,
  Headset,
  Globe,
  Tag,
  CircleNotch,
  CheckCircle,
  XCircle,
  Trash,
  Stop,
} from '@phosphor-icons/react'
import { useCustomer } from 'autumn-js/react'
import { useCredits } from '@/hooks/use-credits'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import PlanDialog from '@/components/plan-dialog'
import {
  useDeployProject,
  useCancelDeployment,
  useRenameProject,
  useUpdateProjectVisibility,
  useLatestDeploymentQuery,
  useHostnameAvailability,
} from '@/queries/projects'
import { useProjectDomains, useRemoveDomain } from '@/queries/domains'
import { http } from '@/lib/http'
import GitHubDialog from '@/components/github-dialog'
import DeploymentStatusDialog from '@/components/deployment-status-dialog'
import { useGitHubStatus } from '@/queries/github'
import UserMenu from '@/components/project-header/user-menu'
import PayDialogs from '@/components/project-header/pay-dialogs'
import SellDialog from '@/components/project-header/sell-dialog'
import { PreviewButton } from '@/components/publish'

// Types
interface ProjectHeaderProps {
  projectId?: string
  project?: {
    name?: string
    isPublic?: boolean
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
}

// Styles
const iconBtn = 'p-1 hover:bg-muted/40 rounded-md transition-all duration-100'

// Status labels
const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  starting: 'Starting',
  deploying_convex: 'Deploying Convex',
  building: 'Building',
  uploading: 'Uploading',
  deployed: 'Deployed',
  build_failed: 'Build failed',
  deploy_failed: 'Deploy failed',
  cancelled: 'Cancelled',
}

const TERMINAL_STATUSES = ['deployed', 'deploy_failed', 'build_failed', 'cancelled']

function sanitizeHostname(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

export default function ProjectHeader({ projectId, project }: ProjectHeaderProps) {
  const router = useRouter()
  const credits = useCredits()
  const { check: checkFeature } = useCustomer()
  const canToggleVisibility = checkFeature({ featureId: 'private_projects' }).data?.allowed ?? false

  // Dialog states
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false)
  const [isDeploymentStatusOpen, setIsDeploymentStatusOpen] = useState(false)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isSellOpen, setIsSellOpen] = useState(false)

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isEditingHostname, setIsEditingHostname] = useState(false)
  const [hostnameInput, setHostnameInput] = useState('')
  const [pendingHostname, setPendingHostname] = useState('')

  // Loading states
  const [isDeploying, setIsDeploying] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Queries & mutations
  const deployProject = useDeployProject()
  const cancelDeployment = useCancelDeployment()
  const renameProject = useRenameProject()
  useGitHubStatus(projectId, { enabled: isGitHubDialogOpen })
  const { data: latestDeployment } = useLatestDeploymentQuery(projectId)
  const updateVisibility = useUpdateProjectVisibility()
  const { data: domainsData } = useProjectDomains(projectId)
  const removeDomain = useRemoveDomain()

  // Domain states
  const activeDomain = domainsData?.domains?.find((d) => d.status === 'active')
  const configuringDomain = domainsData?.domains?.find((d) => d.status === 'dns_configuring')
  const pendingDomain = domainsData?.domains?.find(
    (d) => d.status === 'pending' || d.status === 'purchasing',
  )
  const errorDomain = domainsData?.domains?.find((d) => d.status === 'error')
  // For display: pick the most relevant domain to show
  const displayDomain = activeDomain || configuringDomain || pendingDomain || errorDomain

  // Toast when deployment completes
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!latestDeployment) return
    const prev = prevStatusRef.current
    const curr = latestDeployment.status

    if (prev && !TERMINAL_STATUSES.includes(prev) && TERMINAL_STATUSES.includes(curr)) {
      if (curr === 'deployed') {
        toast.success(`Deployed to ${latestDeployment.scriptName}.surgent.site`, {
          position: 'top-right',
        })
      } else if (curr !== 'cancelled') {
        toast.error(`Deployment failed`, { position: 'top-right' })
      }
    }
    prevStatusRef.current = curr
  }, [latestDeployment])

  // Derived state
  const worker = project?.worker
  const workerName = worker?.name
  const workerStatus = worker?.status ?? ''
  const isDeployed = workerStatus === 'active'
  const isFailed = workerStatus === 'error'
  const isDeploymentInProgress =
    latestDeployment && !TERMINAL_STATUSES.includes(latestDeployment.status)
  // Hostname availability check
  const sanitizedHostname = sanitizeHostname(hostnameInput)
  const isNewHostname = !workerName || sanitizedHostname !== workerName
  const { data: availability, isLoading: checkingHostname } = useHostnameAvailability(
    sanitizedHostname,
    projectId,
    isPublishOpen && sanitizedHostname.length > 0 && isNewHostname,
  )
  const hostnameTaken = isNewHostname && availability?.available === false

  useEffect(() => {
    if (!pendingHostname) return
    if (!workerName) return
    if (pendingHostname !== workerName) return
    setPendingHostname('')
    setIsEditingHostname(false)
  }, [pendingHostname, workerName])

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

  const handleDeploy = useCallback(
    (name: string) => {
      if (!projectId || isDeploying) return
      setIsDeploying(true)
      deployProject.mutate(
        { id: projectId, deployName: name },
        {
          onSuccess: () => setIsDeploying(false),
          onError: (err: unknown) => {
            const resp = (err as { response?: { status?: number } })?.response
            if (resp?.status === 402) {
              credits.setPlanDialogOpen(true)
            } else {
              toast.error(err instanceof Error ? err.message : 'Failed to deploy', {
                position: 'top-right',
              })
            }
            setIsDeploying(false)
          },
        },
      )
    },
    [deployProject, isDeploying, projectId, credits],
  )

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

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${workerName}.surgent.site`)
    toast.success('Copied', { position: 'top-right' })
  }

  const startEditHostname = () => {
    setHostnameInput(workerName || '')
    setIsEditingHostname(true)
  }

  const cancelEditHostname = () => setIsEditingHostname(false)

  const handlePublishOpenChange = (open: boolean) => {
    setIsPublishOpen(open)
    if (open) {
      // Pre-fill with existing worker name, or generate a slug from the project name
      const defaultHostname = workerName || sanitizeHostname(project?.name || '')
      setHostnameInput(defaultHostname)
      setIsEditingHostname(false)
    }
  }

  const submitHostname = () => {
    const name = !workerName || isEditingHostname ? hostnameInput.trim() : workerName
    if (!name) return
    if (isDeploymentInProgress) return

    setPendingHostname(name)
    handleDeploy(name)
  }

  const handleCancelDeploy = () => {
    if (!projectId || !latestDeployment?.id || !isDeploymentInProgress) return
    cancelDeployment.mutate(
      { id: projectId, deploymentId: latestDeployment.id },
      {
        onSuccess: () => {
          setIsDeploying(false)
          toast.success('Deployment cancelled', { position: 'top-right' })
        },
        onError: () => toast.error('Failed to cancel', { position: 'top-right' }),
      },
    )
  }

  return (
    <>
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

          {/* Status indicator */}
          {(isDeployed || isFailed) && (
            <Button
              variant="outline"
              onClick={() => setIsDeploymentStatusOpen(true)}
              aria-label={
                isDeployed ? 'Live - View deployment status' : 'Failed - View deployment status'
              }
            >
              <span
                className={`size-2 rounded-full ${isDeployed ? 'bg-emerald-500' : 'bg-red-500'}`}
              />
              <span className="hidden sm:inline">{isDeployed ? 'Live' : 'Failed'}</span>
            </Button>
          )}

          {/* Preview */}
          <PreviewButton />

          {/* Publish */}
          <DropdownMenu open={isPublishOpen} onOpenChange={handlePublishOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="brand" disabled={!projectId} aria-label="Publish project">
                {isDeploying || isDeploymentInProgress ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <RocketLaunch className="size-4" weight="fill" />
                )}
                <span className="hidden sm:inline">
                  {isDeploying || isDeploymentInProgress
                    ? 'Deploying'
                    : workerName
                      ? 'Republish'
                      : 'Publish'}
                </span>
                <CaretDown className="size-3 hidden sm:block" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
              {/* Live URL — only when deployed and not editing */}
              {workerName && !isEditingHostname && (
                <div className="p-3">
                  <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-3 h-8 font-mono text-[13px]">
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="flex-1 truncate">{workerName}.surgent.site</span>
                    <a
                      href={`https://${workerName}.surgent.site`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={iconBtn}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowSquareOut className="size-3.5 text-muted-foreground" />
                    </a>
                    <button onClick={copyUrl} className={iconBtn}>
                      <Copy className="size-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={startEditHostname} className={iconBtn}>
                      <PencilSimple className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}

              {/* Subdomain input — first deploy or editing */}
              {(!workerName || isEditingHostname) && (
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {workerName ? 'Change subdomain' : 'Choose a subdomain'}
                    </span>
                    {sanitizedHostname && isNewHostname && (
                      <>
                        {checkingHostname && (
                          <CircleNotch className="size-3 animate-spin text-muted-foreground" />
                        )}
                        {!checkingHostname && availability?.available && (
                          <CheckCircle className="size-3 text-emerald-500" />
                        )}
                        {!checkingHostname && hostnameTaken && (
                          <span className="flex items-center gap-1 text-[11px] text-destructive">
                            <XCircle className="size-3" />
                            Taken
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    className={`flex items-center h-8 px-3 rounded-md border bg-muted/20 font-mono text-[13px] transition-all duration-100 ${hostnameTaken ? 'border-destructive/40' : 'border-border/50 focus-within:border-foreground/15'}`}
                  >
                    <input
                      value={hostnameInput}
                      onChange={(e) => setHostnameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && hostnameInput.trim() && !hostnameTaken)
                          submitHostname()
                        if (e.key === 'Escape' && workerName) cancelEditHostname()
                      }}
                      placeholder="my-app"
                      className="flex-1 bg-transparent outline-none min-w-0"
                      autoFocus
                    />
                    <span className="text-muted-foreground/60 shrink-0">.surgent.site</span>
                    {workerName && (
                      <button onClick={cancelEditHostname} className={`${iconBtn} ml-1`}>
                        <X className="size-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Deploy + status */}
              <div className="px-3 pb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="brand"
                    className="flex-1"
                    onClick={submitHostname}
                    disabled={
                      isDeploying ||
                      Boolean(isDeploymentInProgress) ||
                      hostnameTaken ||
                      checkingHostname ||
                      (!workerName && !hostnameInput.trim())
                    }
                  >
                    {isDeploying ? (
                      <CircleNotch className="size-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RocketLaunch className="size-3.5 mr-1.5" weight="fill" />
                    )}
                    {!workerName
                      ? 'Deploy'
                      : isEditingHostname && hostnameInput.trim() !== workerName
                        ? 'Save & Deploy'
                        : 'Republish'}
                  </Button>
                  {workerName && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setIsDeploymentStatusOpen(true)}
                    >
                      <Clock className="size-3.5" />
                    </Button>
                  )}
                </div>

                {/* In-progress status + cancel */}
                {latestDeployment && !TERMINAL_STATUSES.includes(latestDeployment.status) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CircleNotch className="size-3 animate-spin text-brand shrink-0" />
                    <span className="flex-1">
                      {STATUS_LABELS[latestDeployment.status] || latestDeployment.status}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelDeploy}
                      disabled={cancelDeployment.isPending}
                      className="flex items-center gap-1 text-[11px] text-destructive/70 hover:text-destructive transition-colors shrink-0"
                    >
                      <Stop className="size-3" weight="fill" />
                      {cancelDeployment.isPending ? 'Cancelling' : 'Cancel'}
                    </button>
                  </div>
                )}

                {/* Cancelled status */}
                {latestDeployment?.status === 'cancelled' && (
                  <p className="text-xs text-muted-foreground truncate">Deployment cancelled</p>
                )}

                {/* Error status */}
                {latestDeployment &&
                  TERMINAL_STATUSES.includes(latestDeployment.status) &&
                  !['deployed', 'cancelled'].includes(latestDeployment.status) && (
                    <p className="text-xs text-destructive truncate">
                      {latestDeployment.error || 'Deployment failed'}
                    </p>
                  )}
              </div>

              {/* Custom Domain */}
              <div className="border-t px-3 py-2.5">
                {activeDomain ? (
                  <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-emerald-500/6 border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono text-xs truncate flex-1">
                      {activeDomain.domainName}
                    </span>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Live
                    </span>
                    <a
                      href={`https://${activeDomain.domainName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 hover:bg-emerald-500/10 rounded transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowSquareOut className="size-3.5 text-emerald-600" />
                    </a>
                  </div>
                ) : displayDomain ? (
                  <button
                    className="flex items-center gap-2 w-full h-8 px-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
                    onClick={() => {
                      setIsPublishOpen(false)
                      setIsDeploymentStatusOpen(true)
                    }}
                  >
                    {displayDomain.status === 'error' ? (
                      <span className="size-1.5 rounded-full bg-red-500 shrink-0" />
                    ) : (
                      <CircleNotch className="size-3 animate-spin text-amber-500 shrink-0" />
                    )}
                    <span className="font-mono text-xs truncate flex-1">
                      {displayDomain.domainName === 'pending'
                        ? 'Processing...'
                        : displayDomain.domainName}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${displayDomain.status === 'error' ? 'text-red-500' : 'text-amber-500'}`}
                    >
                      {displayDomain.status === 'error'
                        ? 'Failed'
                        : displayDomain.status === 'dns_configuring'
                          ? 'DNS'
                          : 'Pending'}
                    </span>
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-2 w-full h-8 px-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    onClick={() => {
                      setIsPublishOpen(false)
                      setIsDeploymentStatusOpen(true)
                    }}
                  >
                    <Globe className="size-3.5 text-brand shrink-0" weight="duotone" />
                    <span className="text-xs font-medium text-foreground/80">
                      Add custom domain
                    </span>
                  </button>
                )}
              </div>

              {/* Visibility */}
              <div className="border-t px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Globe className="size-3.5 text-muted-foreground/70" weight="duotone" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {(project?.isPublic ?? true) ? 'Public' : 'Private'}
                  </span>
                  {!canToggleVisibility && (
                    <button
                      onClick={() => credits.setPlanDialogOpen(true)}
                      className="ml-auto text-[10px] font-medium text-brand hover:text-brand/80 transition-colors"
                    >
                      Upgrade
                    </button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Switch
                          className={canToggleVisibility ? 'ml-auto' : ''}
                          checked={project?.isPublic ?? true}
                          onCheckedChange={(checked) => {
                            if (!projectId) return
                            updateVisibility.mutate(
                              { id: projectId, isPublic: checked },
                              {
                                onError: () =>
                                  toast.error('Failed to update visibility', {
                                    position: 'top-right',
                                  }),
                              },
                            )
                          }}
                          disabled={!canToggleVisibility}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {canToggleVisibility
                        ? (project?.isPublic ?? true)
                          ? 'Make private'
                          : 'Make public'
                        : 'Upgrade to control visibility'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <UserMenu onUpgrade={() => credits.setPlanDialogOpen(true)} />
      </header>

      {/* Dialogs */}
      <GitHubDialog
        open={isGitHubDialogOpen}
        onOpenChange={setIsGitHubDialogOpen}
        projectId={projectId}
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
