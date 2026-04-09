'use client'

import {
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Clock,
  Copy,
  Globe,
  PencilSimple,
  RocketLaunch,
  Stop,
  Tag,
  X,
  XCircle,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import DeploymentStatusDialog from '@/components/deployment-status-dialog'
import SellDialog from '@/components/project-header/sell-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { useProjectDomains } from '@/queries/domains'
import {
  useCancelDeployment,
  useDeployProject,
  useGenerateHostname,
  useHostnameAvailability,
  useLatestDeploymentQuery,
  useUpdateProjectVisibility,
} from '@/queries/projects'

const iconBtn = 'p-1 hover:bg-muted/40 rounded-md transition-all duration-100 cursor-pointer'

interface PublishButtonProps {
  projectId?: string
  project?: {
    name?: string
    isPublic?: boolean
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
}

export default function PublishButton({ projectId, project }: PublishButtonProps) {
  const queryClient = useQueryClient()
  const credits = useCredits()
  const canToggleVisibility = credits.snapshot?.features.privateProjects ?? false

  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isDeploymentStatusOpen, setIsDeploymentStatusOpen] = useState(false)
  const [isSellOpen, setIsSellOpen] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isEditingHostname, setIsEditingHostname] = useState(false)
  const [hostnameInput, setHostnameInput] = useState<string | null>(null)

  const deployProject = useDeployProject()
  const cancelDeployment = useCancelDeployment()
  const updateVisibility = useUpdateProjectVisibility()
  const { data: latestDeployment } = useLatestDeploymentQuery(projectId)
  const { data: domainsData } = useProjectDomains(projectId)

  const worker = project?.worker
  const workerName = worker?.name
  const workerStatus = worker?.status ?? ''
  const isDeployed = workerStatus === 'active'
  const isFailed = workerStatus === 'error'
  const isDeploymentInProgress =
    latestDeployment && !TERMINAL_DEPLOYMENT_STATUSES.includes(latestDeployment.status)

  const { data: generatedHostname } = useGenerateHostname(isPublishOpen && !workerName)
  const hostnameValue = hostnameInput ?? workerName ?? generatedHostname?.name ?? ''
  const sanitizedHostname = sanitizeDeploymentHostname(hostnameValue)
  const isNewHostname = !workerName || sanitizedHostname !== workerName
  const { data: availability, isLoading: checkingHostname } = useHostnameAvailability(
    sanitizedHostname,
    projectId,
    isPublishOpen && sanitizedHostname.length > 0 && isNewHostname,
  )
  const hostnameTaken = isNewHostname && availability?.available === false

  const activeDomains = domainsData?.domains?.filter((d) => d.status === 'active') ?? []
  const activeDomain = activeDomains[0]
  const configuringDomain = domainsData?.domains?.find((d) => d.status === 'dns_configuring')
  const pendingDomain = domainsData?.domains?.find(
    (d) => d.status === 'pending' || d.status === 'purchasing',
  )
  const errorDomain = domainsData?.domains?.find((d) => d.status === 'error')
  const displayDomain = activeDomain || configuringDomain || pendingDomain || errorDomain

  // Toast on deploy complete
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
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      if (curr === 'deployed') {
        toast.success(`Deployed to ${latestDeployment.scriptName}.surgent.site`)
      } else if (curr !== 'cancelled') {
        toast.error('Deployment failed')
      }
    }
    prevStatusRef.current = curr
  }, [latestDeployment, queryClient, projectId])

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
            if (resp?.status === 402) credits.openBalanceDialog()
            else toast.error(err instanceof Error ? err.message : 'Failed to deploy')
            setIsDeploying(false)
          },
        },
      )
    },
    [deployProject, isDeploying, projectId, credits],
  )

  const submitHostname = () => {
    if (isDeploymentInProgress) return
    const name = !workerName || isEditingHostname ? hostnameValue.trim() : workerName
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

  const handlePublishOpenChange = (open: boolean) => {
    setIsPublishOpen(open)
    setHostnameInput(null)
    setIsEditingHostname(false)
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${workerName}.surgent.site`)
    toast.success('Copied')
  }

  return (
    <>
      {/* Status indicator */}
      {(isDeployed || isFailed) && (
        <Button variant="ghost" size="sm" onClick={() => setIsDeploymentStatusOpen(true)}>
          <span className={`size-2 rounded-full ${isDeployed ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {isDeployed ? 'Live' : 'Failed'}
        </Button>
      )}

      {/* Publish dropdown */}
      <DropdownMenu open={isPublishOpen} onOpenChange={handlePublishOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="brand" size="sm" disabled={!projectId}>
            {isDeploying || isDeploymentInProgress ? (
              <CircleNotch className="size-3.5 animate-spin" />
            ) : (
              <RocketLaunch className="size-3.5" weight="fill" />
            )}
            {isDeploying || isDeploymentInProgress
              ? 'Deploying'
              : workerName
                ? 'Republish'
                : 'Publish'}
            <CaretDown className="size-3" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
          {/* Live URL */}
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
                  <button
                    onClick={() => {
                      setHostnameInput(workerName || '')
                      setIsEditingHostname(true)
                    }}
                    className={iconBtn}
                  >
                    <PencilSimple className="size-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Subdomain input */}
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
                        <XCircle className="size-3" /> Taken
                      </span>
                    )}
                  </>
                )}
              </div>
              <div
                className={`flex items-center h-8 px-3 rounded-md border bg-muted/20 font-mono text-[13px] transition-all duration-100 ${hostnameTaken ? 'border-destructive/40' : 'border-border/50 focus-within:border-foreground/15'}`}
              >
                <input
                  value={hostnameValue}
                  onChange={(e) => setHostnameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && hostnameValue.trim() && !hostnameTaken)
                      submitHostname()
                    if (e.key === 'Escape' && workerName) setIsEditingHostname(false)
                  }}
                  placeholder="my-app"
                  className="flex-1 bg-transparent outline-none min-w-0"
                  autoFocus
                />
                <span className="text-muted-foreground/60 shrink-0">.surgent.site</span>
                {workerName && (
                  <button onClick={() => setIsEditingHostname(false)} className={`${iconBtn} ml-1`}>
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
                  : isEditingHostname && hostnameValue.trim() !== workerName
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
            {latestDeployment &&
              !TERMINAL_DEPLOYMENT_STATUSES.includes(latestDeployment.status) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleNotch className="size-3 animate-spin text-foreground/50 shrink-0" />
                  <span className="flex-1">
                    {DEPLOYMENT_STATUS_LABELS[latestDeployment.status] || latestDeployment.status}
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
            {latestDeployment?.status === 'cancelled' && (
              <p className="text-xs text-muted-foreground truncate">Deployment cancelled</p>
            )}
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
                <span className="text-xs font-medium text-foreground/80">Add custom domain</span>
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
                          { onError: () => toast.error('Failed to update visibility') },
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

          {/* Sell */}
          <div className="border-t px-3 py-2.5">
            <button
              className="flex items-center gap-2 w-full h-8 px-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              onClick={() => {
                setIsPublishOpen(false)
                if (!workerName) {
                  toast('Publish your app first before listing', { icon: '🚀' })
                  return
                }
                setIsSellOpen(true)
              }}
            >
              <Tag className="size-3.5 text-muted-foreground/70" weight="fill" />
              <span className="text-xs font-medium text-foreground/80">Sell on marketplace</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <DeploymentStatusDialog
        open={isDeploymentStatusOpen}
        onOpenChange={setIsDeploymentStatusOpen}
        projectId={projectId}
        worker={worker}
      />
      <SellDialog
        open={isSellOpen}
        onOpenChange={setIsSellOpen}
        projectId={projectId}
        projectName={project?.name}
        screenshotUrl={latestDeployment?.screenshotUrl}
      />
    </>
  )
}
