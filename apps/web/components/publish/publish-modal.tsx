'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import {
  RocketLaunch,
  PencilSimple,
  X,
  Copy,
  ArrowSquareOut,
  Globe,
  CircleNotch,
  CheckCircle,
  XCircle,
  Clock,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react'
import { useCustomer } from 'autumn-js/react'
import { useCredits } from '@/hooks/use-credits'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  useDeployProject,
  useUpdateProjectVisibility,
  useLatestDeploymentQuery,
  useHostnameAvailability,
} from '@/queries/projects'
import { useProjectDomains } from '@/queries/domains'
import { DomainSearchPanel } from '@/components/domains/domain-search-panel'
import { QrCodeCard } from './qr-code-card'
import { ShareButtons } from './share-buttons'

interface PublishModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  project?: {
    name?: string
    isPublic?: boolean
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
  onOpenHistory: () => void
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  starting: 'Starting',
  deploying_convex: 'Deploying Convex',
  building: 'Building',
  uploading: 'Uploading',
  deployed: 'Deployed',
  build_failed: 'Build failed',
  deploy_failed: 'Deploy failed',
}

const TERMINAL_STATUSES = ['deployed', 'deploy_failed', 'build_failed']

function sanitizeHostname(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

const iconBtn = 'p-1 hover:bg-muted/40 rounded-md transition-all duration-100'

export function PublishModal({
  open,
  onOpenChange,
  projectId,
  project,
  onOpenHistory,
}: PublishModalProps) {
  const credits = useCredits()
  const { check: checkFeature } = useCustomer()
  const canToggleVisibility = checkFeature({ featureId: 'private_projects' }).data?.allowed ?? false

  const [isEditingHostname, setIsEditingHostname] = useState(false)
  const [hostnameInput, setHostnameInput] = useState('')
  const [pendingHostname, setPendingHostname] = useState('')
  const [isDeploying, setIsDeploying] = useState(false)
  const [shareExpanded, setShareExpanded] = useState(false)

  const deployProject = useDeployProject()
  const { data: latestDeployment } = useLatestDeploymentQuery(projectId)
  const updateVisibility = useUpdateProjectVisibility()
  const { data: domainsData } = useProjectDomains(projectId)

  const worker = project?.worker
  const workerName = worker?.name
  const isDeployed = worker?.status === 'active'
  const isDeploymentInProgress =
    latestDeployment && !TERMINAL_STATUSES.includes(latestDeployment.status)

  const sanitizedHostname = sanitizeHostname(hostnameInput)
  const isNewHostname = !workerName || sanitizedHostname !== workerName
  const { data: availability, isLoading: checkingHostname } = useHostnameAvailability(
    sanitizedHostname,
    projectId,
    open && sanitizedHostname.length > 0 && isNewHostname,
  )
  const hostnameTaken = isNewHostname && availability?.available === false
  const activeDomain = domainsData?.domains?.find((d) => d.status === 'active')

  const liveUrl = activeDomain
    ? `https://${activeDomain.domainName}`
    : workerName
      ? `https://${workerName}.surgent.site`
      : null

  // Toast on deployment complete
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
      } else {
        toast.error('Deployment failed', { position: 'top-right' })
      }
    }
    prevStatusRef.current = curr
  }, [latestDeployment])

  // Sync pending hostname
  useEffect(() => {
    if (!pendingHostname || !workerName || pendingHostname !== workerName) return
    setPendingHostname('')
    setIsEditingHostname(false)
  }, [pendingHostname, workerName])

  // Pre-fill hostname when modal opens
  useEffect(() => {
    if (open) {
      const defaultHostname = workerName || sanitizeHostname(project?.name || '')
      setHostnameInput(defaultHostname)
      setIsEditingHostname(false)
    }
  }, [open, workerName, project?.name])

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

  const submitHostname = () => {
    const name = !workerName || isEditingHostname ? hostnameInput.trim() : workerName
    if (!name || isDeploymentInProgress) return
    setPendingHostname(name)
    handleDeploy(name)
  }

  const copyUrl = () => {
    if (!liveUrl) return
    navigator.clipboard.writeText(liveUrl)
    toast.success('Copied', { position: 'top-right' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-2.5">
            {isDeployed && <span className="size-2 rounded-full bg-emerald-500 shrink-0" />}
            <DialogTitle className="text-base">
              {workerName ? 'Share your app' : 'Publish your app'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {workerName
              ? 'Your app is live. Share it with the world.'
              : 'Deploy your app to a public URL in one click.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Live URL — shown when deployed and not editing */}
          {workerName && !isEditingHostname && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Live URL</label>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 h-9 font-mono text-[13px]">
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
                <button
                  onClick={() => {
                    setHostnameInput(workerName)
                    setIsEditingHostname(true)
                  }}
                  className={iconBtn}
                >
                  <PencilSimple className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

          {/* Subdomain input — first deploy or editing */}
          {(!workerName || isEditingHostname) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {workerName ? 'Change subdomain' : 'Choose a subdomain'}
                </label>
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
                className={`flex items-center h-9 px-3 rounded-lg border bg-muted/20 font-mono text-[13px] transition-all duration-100 ${
                  hostnameTaken
                    ? 'border-destructive/40'
                    : 'border-border/50 focus-within:border-foreground/15'
                }`}
              >
                <input
                  value={hostnameInput}
                  onChange={(e) => setHostnameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && hostnameInput.trim() && !hostnameTaken)
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

          {/* Deploy button */}
          <Button
            variant="brand"
            size="lg"
            className="w-full"
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
              <CircleNotch className="size-4 animate-spin mr-1.5" />
            ) : (
              <RocketLaunch className="size-4 mr-1.5" weight="fill" />
            )}
            {!workerName
              ? 'Publish'
              : isEditingHostname && hostnameInput.trim() !== workerName
                ? 'Save & Deploy'
                : 'Republish'}
          </Button>

          {/* In-progress status */}
          {latestDeployment && !TERMINAL_STATUSES.includes(latestDeployment.status) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleNotch className="size-3 animate-spin text-brand" />
              {STATUS_LABELS[latestDeployment.status] || latestDeployment.status}
            </div>
          )}

          {/* Error status */}
          {latestDeployment &&
            TERMINAL_STATUSES.includes(latestDeployment.status) &&
            latestDeployment.status !== 'deployed' && (
              <p className="text-xs text-destructive truncate">
                {latestDeployment.error || 'Deployment failed'}
              </p>
            )}
        </div>

        {/* Share section — only when deployed */}
        {workerName && liveUrl && (
          <div className="border-t">
            <button
              type="button"
              onClick={() => setShareExpanded(!shareExpanded)}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Share
              </span>
              {shareExpanded ? (
                <CaretUp className="size-3.5 text-muted-foreground" />
              ) : (
                <CaretDown className="size-3.5 text-muted-foreground" />
              )}
            </button>
            {shareExpanded && (
              <div className="px-5 pb-4 space-y-4">
                <ShareButtons url={liveUrl} />
                <QrCodeCard url={liveUrl} size={100} />
              </div>
            )}
          </div>
        )}

        {/* Custom Domain — temporarily hidden
        {projectId && (
          <div className="border-t">
            <DomainSearchPanel projectId={projectId} />
          </div>
        )}
        */}

        {/* Visibility */}
        <div className="border-t px-5 py-3">
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

        {/* Footer — deployment history link */}
        {workerName && (
          <div className="border-t px-5 py-3">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onOpenHistory()
              }}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="size-3.5" />
              View deployment history
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
