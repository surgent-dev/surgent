'use client'

import {
  ArrowLeft,
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Clock,
  Copy,
  DiscordLogo,
  DownloadSimple,
  Envelope,
  GithubLogo,
  Globe,
  Headset,
  PencilSimple,
  RocketLaunch,
  Stop,
  Tag,
  TelegramLogo,
  X,
  XCircle,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import DeploymentStatusDialog from '@/components/deployment-status-dialog'
import GitHubDialog from '@/components/github-dialog'
import MigrationCreditBanner from '@/components/migration-credit-banner'
import PlanDialog from '@/components/plan-dialog'
import PayDialogs from '@/components/project-header/pay-dialogs'
import SellDialog from '@/components/project-header/sell-dialog'
import UserMenu from '@/components/project-header/user-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'
import {
  DEPLOYMENT_STATUS_LABELS,
  sanitizeDeploymentHostname,
  TERMINAL_DEPLOYMENT_STATUSES,
} from '@/lib/deployment'
import { http } from '@/lib/http'
import { useProjectDomains, useRemoveDomain } from '@/queries/domains'
import { useGitHubStatus } from '@/queries/github'
import {
  useCancelDeployment,
  useDeployProject,
  useGenerateHostname,
  useHostnameAvailability,
  useLatestDeploymentQuery,
  useRenameProject,
  useUpdateProjectVisibility,
} from '@/queries/projects'

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

export default function ProjectHeader({ projectId, project }: ProjectHeaderProps) {
  const router = useRouter()
  const credits = useCredits()
  const canToggleVisibility = credits.snapshot?.features.privateProjects ?? false

  const queryClient = useQueryClient()

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
  const _removeDomain = useRemoveDomain()

  // Domain states
  const activeDomains = domainsData?.domains?.filter((d) => d.status === 'active') ?? []
  const activeDomain = activeDomains[0]
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

    if (
      prev &&
      !TERMINAL_DEPLOYMENT_STATUSES.includes(prev) &&
      TERMINAL_DEPLOYMENT_STATUSES.includes(curr)
    ) {
      // Refetch project data so worker info is up-to-date
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      if (curr === 'deployed') {
        toast.success(`Deployed to ${latestDeployment.scriptName}.surgent.site`, {})
      } else if (curr !== 'cancelled') {
        toast.error(`Deployment failed`)
      }
    }
    prevStatusRef.current = curr
  }, [latestDeployment, queryClient, projectId])

  // Derived state
  const worker = project?.worker
  const workerName = worker?.name
  const workerStatus = worker?.status ?? ''
  const isDeployed = workerStatus === 'active'
  const isFailed = workerStatus === 'error'
  const isDeploymentInProgress =
    latestDeployment && !TERMINAL_DEPLOYMENT_STATUSES.includes(latestDeployment.status)
  const { data: generatedHostname } = useGenerateHostname(isPublishOpen && !workerName)
  // Hostname availability check
  const sanitizedHostname = sanitizeDeploymentHostname(hostnameInput)
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
        onError: () => toast.error('Failed to rename'),
      },
    )
  }

  const handleDeploy = useCallback(
    (name: string) => {
      if (!projectId || isDeploying) return
      setIsDeploying(true)
      deployProject.mutate(
        { id: projectId, deployName: name || undefined },
        {
          onSuccess: () => setIsDeploying(false),
          onError: (err: unknown) => {
            const resp = (err as { response?: { status?: number } })?.response
            if (resp?.status === 402) {
              credits.setPlanDialogOpen(true)
            } else {
              toast.error(err instanceof Error ? err.message : 'Failed to deploy', {})
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
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        credits.setPlanDialogOpen(true)
      } else {
        toast.error(err instanceof Error ? err.message : 'Download failed', {})
      }
    } finally {
      setDownloading(false)
    }
  }, [projectId, downloading, project?.name, credits])

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${workerName}.surgent.site`)
    toast.success('Copied')
  }

  const startEditHostname = () => {
    setHostnameInput(workerName || '')
    setIsEditingHostname(true)
  }

  const cancelEditHostname = () => setIsEditingHostname(false)

  const handlePublishOpenChange = (open: boolean) => {
    setIsPublishOpen(open)
    if (open) {
      setHostnameInput(workerName || generatedHostname?.name || '')
      setIsEditingHostname(false)
    }
  }

  // Pre-fill with backend-generated hostname when it arrives (first deploy)
  useEffect(() => {
    if (!workerName && generatedHostname?.name && !hostnameInput) {
      setHostnameInput(generatedHostname.name)
    }
  }, [generatedHostname, workerName, hostnameInput])

  const submitHostname = () => {
    if (isDeploymentInProgress) return
    const name = !workerName || isEditingHostname ? hostnameInput.trim() : workerName
    if (name) setPendingHostname(name)
    handleDeploy(name || '')
  }

  const handleCancelDeploy = () => {
    if (!projectId || !latestDeployment?.id || !isDeploymentInProgress) return
    cancelDeployment.mutate(
      { id: projectId, deploymentId: latestDeployment.id },
      {
        onSuccess: () => {
          setIsDeploying(false)
          toast.success('Deployment cancelled')
        },
        onError: () => toast.error('Failed to cancel'),
      },
    )
  }

  return (
    <>
      <header className="h-11 flex items-center bg-white dark:bg-background shrink-0 pl-3 pr-4">
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
                <Headset className="size-4" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="w-52 rounded-lg border-border/40 p-1 shadow-[0_8px_16px_-4px_#00000014,0_4px_6px_-2px_#0000000a,0_0_0_1px_#0000000f]"
            >
              <div className="px-3.5 py-2.5 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-1.5 rounded-full bg-foreground/30" />
                  <span className="text-[13px] font-medium">Support</span>
                </div>
              </div>
              <DropdownMenuItem
                className="gap-2 rounded-md px-2 py-2 text-[12px] cursor-pointer"
                onClick={() => navigator.clipboard.writeText('avron@surgent.dev')}
              >
                <Envelope className="size-3.5 text-muted-foreground/70" weight="duotone" />
                <span className="flex-1 truncate text-[12px]">avron@surgent.dev</span>
                <Copy className="size-3 text-muted-foreground/40" weight="bold" />
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="gap-2 rounded-md px-2 py-2 text-[12px] cursor-pointer"
              >
                <a href="https://discord.gg/DRWbFEtY" target="_blank" rel="noopener noreferrer">
                  <DiscordLogo className="size-3.5 text-muted-foreground/70" weight="fill" />
                  <span className="flex-1 text-[12px]">Discord</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="gap-2 rounded-md px-2 py-2 text-[12px] cursor-pointer"
              >
                <a href="https://t.me/bensurgent" target="_blank" rel="noopener noreferrer">
                  <TelegramLogo className="size-3.5 text-muted-foreground/70" weight="fill" />
                  <span className="flex-1 text-[12px]">Telegram</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
                  <div
                    className={`flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-3 h-8 font-mono text-[13px] ${activeDomain ? 'opacity-50' : ''}`}
                  >
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
                    {!activeDomain && (
                      <button onClick={startEditHostname} className={iconBtn}>
                        <PencilSimple className="size-3.5 text-muted-foreground" />
                      </button>
                    )}
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
                      (isEditingHostname && (hostnameTaken || checkingHostname))
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
                {latestDeployment &&
                  !TERMINAL_DEPLOYMENT_STATUSES.includes(latestDeployment.status) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CircleNotch className="size-3 animate-spin text-foreground/50 shrink-0" />
                      <span className="flex-1">
                        {DEPLOYMENT_STATUS_LABELS[latestDeployment.status] ||
                          latestDeployment.status}
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
                  TERMINAL_DEPLOYMENT_STATUSES.includes(latestDeployment.status) &&
                  !['deployed', 'cancelled'].includes(latestDeployment.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(latestDeployment.error || 'Deployment failed')
                        toast.success('Copied to clipboard')
                      }}
                      className="group w-full text-left rounded-md bg-destructive/5 border border-destructive/10 px-2.5 py-2 cursor-copy"
                    >
                      <p className="text-[11px] font-mono text-destructive/80 line-clamp-3">
                        {latestDeployment.error || 'Deployment failed'}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                        <Copy className="size-3" />
                        Click to copy
                      </span>
                    </button>
                  )}
              </div>

              {/* Custom Domain */}
              <div className="border-t px-3 py-2.5">
                {activeDomains.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeDomains.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-muted/40 border border-border/50"
                      >
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-mono text-xs truncate flex-1">{d.domainName}</span>
                        <span className="text-[10px] font-medium text-muted-foreground">Live</span>
                        {activeDomains.length > 1 && (
                          <span className="text-[8px] font-semibold px-1 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            {d.isPrimary ? 'PRIMARY' : 'ALIAS'}
                          </span>
                        )}
                        <a
                          href={`https://${d.domainName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-0.5 hover:bg-muted rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ArrowSquareOut className="size-3.5 text-muted-foreground" />
                        </a>
                      </div>
                    ))}
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
                    <Globe className="size-3.5 text-foreground/50 shrink-0" weight="duotone" />
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
                      className="ml-auto text-[10px] font-medium text-foreground/60 hover:text-foreground transition-colors"
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
                                onError: () => toast.error('Failed to update visibility', {}),
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

              {/* Sell on marketplace */}
              <div className="border-t px-3 py-2.5">
                <button
                  className="flex items-center gap-2 w-full h-8 px-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    setIsPublishOpen(false)
                    if (!workerName) {
                      toast('Publish your app first before listing', {
                        icon: '\uD83D\uDE80',
                      })
                      return
                    }
                    setIsSellOpen(true)
                  }}
                >
                  <Tag className="size-3.5 text-muted-foreground/70" weight="fill" />
                  <span className="text-xs font-medium text-foreground/80">
                    Sell on marketplace
                  </span>
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <UserMenu onUpgrade={() => credits.setPlanDialogOpen(true)} />
      </header>
      <MigrationCreditBanner showDialog onUpgrade={() => credits.setPlanDialogOpen(true)} />

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
