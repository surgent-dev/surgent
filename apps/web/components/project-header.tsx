'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { Loader2, CheckCircle2, XCircle, Sun, Moon } from 'lucide-react'
import {
  ArrowLeft,
  RocketLaunch,
  PencilSimple,
  DownloadSimple,
  Warning,
  X,
  GithubLogo,
  SignOut,
  ChartBar,
  CaretDown,
  Copy,
  Clock,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import UsageDialog from '@/components/usage-dialog'
import { authClient } from '@/lib/auth-client'
import {
  useDeployProject,
  useRenameProject,
  useLatestDeploymentQuery,
  useHostnameAvailability,
} from '@/queries/projects'
import { http } from '@/lib/http'
import GitHubDialog from '@/components/github-dialog'
import DeploymentStatusDialog from '@/components/deployment-status-dialog'
import { useGitHubStatus } from '@/queries/github'
import { useSandbox } from '@/hooks/use-sandbox'
import { useSurpayConnect, useSurpayMoveAccount } from '@/queries/surpay'

// Types
interface User {
  id: string
  email: string
  name?: string
  image?: string
}

interface ProjectHeaderProps {
  projectId?: string
  project?: {
    name?: string
    worker?: { name: string; status: string | null; hostname: string | null } | null
  }
}

// Styles
const headerBtn =
  'flex items-center gap-1.5 px-2 sm:px-4 text-sm text-muted-foreground hover:bg-muted/50 border-l transition-colors disabled:opacity-50'
const iconBtn = 'p-1 hover:bg-background rounded transition-colors'

// Status labels
const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  starting: 'Starting',
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

export default function ProjectHeader({ projectId, project }: ProjectHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()

  // User state
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    authClient.getSession().then(({ data }) => data?.user && setUser(data.user as User))
  }, [])

  // Dialog states
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false)
  const [isUsageOpen, setIsUsageOpen] = useState(false)
  const [isDeploymentStatusOpen, setIsDeploymentStatusOpen] = useState(false)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isStripeSuccessOpen, setIsStripeSuccessOpen] = useState(false)
  const [isStripeConflictOpen, setIsStripeConflictOpen] = useState(false)
  const [conflictAccountId, setConflictAccountId] = useState<string | null>(null)

  // Stripe success handling
  const setPulsePaymentsTab = useSandbox((s) => s.setPulsePaymentsTab)
  useEffect(() => {
    if (searchParams.get('stripe_connected') === 'true') {
      setIsStripeSuccessOpen(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('stripe_connected')
      const newQuery = params.toString()
      router.replace(newQuery ? `${pathname}?${newQuery}` : pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname, router])

  // Stripe conflict handling
  useEffect(() => {
    if (searchParams.get('stripe_conflict') === 'true') {
      const accountId = searchParams.get('conflict_account_id')
      if (accountId) {
        setConflictAccountId(accountId)
        setIsStripeConflictOpen(true)
      }
      const params = new URLSearchParams(searchParams.toString())
      params.delete('stripe_conflict')
      params.delete('conflict_account_id')
      const newQuery = params.toString()
      router.replace(newQuery ? `${pathname}?${newQuery}` : pathname)
    }
  }, [searchParams, pathname, router])

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isEditingHostname, setIsEditingHostname] = useState(false)
  const [hostnameInput, setHostnameInput] = useState('')
  const [pendingHostname, setPendingHostname] = useState('')

  // Loading states
  const [isDeploying, setIsDeploying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Queries & mutations
  const deployProject = useDeployProject()
  const renameProject = useRenameProject()
  useGitHubStatus(projectId, { enabled: isGitHubDialogOpen }) // Prefetch for dialog
  const { data: latestDeployment } = useLatestDeploymentQuery(projectId)
  const surpayConnect = useSurpayConnect()
  const surpayMoveAccount = useSurpayMoveAccount()

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
      } else {
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
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to deploy', {
              position: 'top-right',
            })
            setIsDeploying(false)
          },
        },
      )
    },
    [deployProject, isDeploying, projectId],
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
    } catch {
      toast.error('Download failed', { position: 'top-right' })
    } finally {
      setDownloading(false)
    }
  }, [projectId, downloading, project?.name])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

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
      // Reset state when opening
      setHostnameInput(workerName || '')
      setIsEditingHostname(false)
    }
  }

  const submitHostname = () => {
    // For first deploy or when editing, use input; otherwise use existing workerName
    const name = !workerName || isEditingHostname ? hostnameInput.trim() : workerName
    if (!name) return
    if (isDeploymentInProgress) return
    setPendingHostname(name)
    handleDeploy(name)
  }

  return (
    <>
      {/* Warning banner */}
      {!bannerDismissed && (
        <div className="bg-warning/10 border-b border-warning/20 px-2 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm min-w-0">
            <Warning className="size-4 text-warning shrink-0" weight="fill" />
            <span className="truncate">
              <span className="font-medium">Heads up!</span> Projects may be deleted after
              inactivity.
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              aria-label="Download project"
              className="h-7 text-xs text-warning hover:bg-warning/20 px-2 sm:px-3"
            >
              {downloading ? (
                <Loader2 className="size-3.5 animate-spin sm:mr-1.5" />
              ) : (
                <DownloadSimple className="size-3.5 sm:mr-1.5" weight="bold" />
              )}
              <span className="hidden sm:inline">Download</span>
            </Button>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss warning"
              className="p-1 rounded hover:bg-warning/20 text-warning"
            >
              <X className="size-4" weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-10 flex items-stretch bg-background border-y shrink-0">
        {/* Back */}
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="Back to dashboard"
          className="flex items-center px-2 sm:px-4 text-muted-foreground hover:bg-muted/50"
        >
          <ArrowLeft className="size-4" />
        </button>

        {/* Logo + Brand */}
        <button
          onClick={() => router.push('/dashboard')}
          className="hidden sm:flex items-center gap-2 px-3 border-l hover:bg-muted/50"
        >
          <Image src="/surgent-coin.svg" alt="Surgent" width={20} height={20} className="size-5" />
          <span className="text-sm font-medium">Surgent</span>
        </button>

        {/* Project name */}
        {isEditing ? (
          <div className="flex items-center px-2 sm:px-4">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              className="h-7 px-2 text-sm font-medium rounded border bg-background outline-none focus:ring-2 focus:ring-ring/50 w-28 sm:w-40"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="group flex items-center gap-1.5 px-2 sm:px-4 text-sm font-medium hover:bg-muted/50 min-w-0"
          >
            <span className="truncate max-w-[100px] sm:max-w-none">
              {project?.name || 'Untitled'}
            </span>
            <PencilSimple className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
          </button>
        )}

        <div className="flex-1" />

        {/* Status indicator */}
        {(isDeployed || isFailed) && (
          <button
            onClick={() => setIsDeploymentStatusOpen(true)}
            aria-label={
              isDeployed ? 'Live - View deployment status' : 'Failed - View deployment status'
            }
            className={headerBtn}
          >
            <span
              className={`size-2 rounded-full ${isDeployed ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
            <span className="hidden sm:inline">{isDeployed ? 'Live' : 'Failed'}</span>
          </button>
        )}

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading || !projectId}
          aria-label="Download project"
          className={headerBtn}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <DownloadSimple className="size-4" />
          )}
          <span className="hidden md:inline">Download</span>
        </button>

        {/* GitHub */}
        <button
          onClick={() => setIsGitHubDialogOpen(true)}
          disabled={!projectId}
          aria-label="GitHub integration"
          className={headerBtn}
        >
          <GithubLogo className="size-4" weight="bold" />
          <span className="hidden md:inline">GitHub</span>
        </button>

        {/* Publish */}
        <DropdownMenu open={isPublishOpen} onOpenChange={handlePublishOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              disabled={!projectId || isDeploying}
              aria-label="Publish project"
              className="flex items-center gap-1.5 px-3 sm:px-5 text-sm font-medium bg-brand text-brand-foreground hover:bg-brand/90 border-l disabled:opacity-50"
            >
              {isDeploying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RocketLaunch className="size-4" weight="fill" />
              )}
              <span className="hidden sm:inline">Publish</span>
              <CaretDown className="size-3 hidden sm:block" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px] sm:w-72 p-0">
            <div className="px-3 py-2.5 border-b">
              <div className="text-sm font-medium">Publish your app</div>
            </div>

            {/* Show status only when deploying or failed */}
            {latestDeployment && !['deployed'].includes(latestDeployment.status) && (
              <div
                className={`px-3 py-2 border-b text-sm ${
                  TERMINAL_STATUSES.includes(latestDeployment.status)
                    ? 'bg-destructive/10'
                    : 'bg-brand/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {TERMINAL_STATUSES.includes(latestDeployment.status) ? (
                    <span className="size-2 rounded-full bg-destructive" />
                  ) : (
                    <Loader2 className="size-3 animate-spin text-brand" />
                  )}
                  <span
                    className={
                      TERMINAL_STATUSES.includes(latestDeployment.status)
                        ? 'text-destructive'
                        : 'text-foreground'
                    }
                  >
                    {STATUS_LABELS[latestDeployment.status] || latestDeployment.status}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {latestDeployment.id.slice(0, 8)}
                  </span>
                </div>
                {latestDeployment.error && (
                  <div className="mt-1 text-xs text-destructive/80 truncate">
                    {latestDeployment.error}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 space-y-3">
              {/* URL */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{workerName ? 'Published URL' : 'Choose a subdomain'}</span>
                  {(!workerName || isEditingHostname) && sanitizedHostname && isNewHostname && (
                    <>
                      {checkingHostname && <Loader2 className="size-3 animate-spin" />}
                      {!checkingHostname && availability?.available && (
                        <CheckCircle2 className="size-3 text-green-600" />
                      )}
                      {!checkingHostname && hostnameTaken && (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="size-3" />
                          Taken
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div
                  className={`flex items-center h-8 px-2.5 rounded-md border text-sm font-mono bg-muted/30 ${hostnameTaken ? 'border-red-500' : ''}`}
                >
                  {!workerName || isEditingHostname ? (
                    <>
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
                      <span className="text-muted-foreground shrink-0">.surgent.site</span>
                      {workerName && (
                        <button onClick={cancelEditHostname} className={`${iconBtn} ml-1`}>
                          <X className="size-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 h-8 bg-brand hover:bg-brand/90 text-brand-foreground"
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
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RocketLaunch className="size-3.5 mr-1.5" weight="fill" />
                  )}
                  {!workerName
                    ? 'Deploy'
                    : isEditingHostname && hostnameInput.trim() !== workerName
                      ? 'Save & Publish'
                      : 'Republish'}
                </Button>
                {workerName && (
                  <Button
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => setIsDeploymentStatusOpen(true)}
                  >
                    <Clock className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="User menu"
              className="flex items-center px-2 sm:px-4 border-l hover:bg-muted/50"
            >
              <Avatar className="size-7">
                <AvatarImage src={user?.image} alt={user?.name || user?.email} />
                <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
                  {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
            <div className="px-3 py-2">
              <div className="text-sm font-medium truncate">{user?.name || 'User'}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <div className="h-px bg-border" />
            <div className="px-1 py-1">
              <DropdownMenuItem
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
                {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
              </DropdownMenuItem>
            </div>
            <div className="h-px bg-border" />
            <div className="px-1 py-1">
              <DropdownMenuItem onClick={() => setIsUsageOpen(true)}>
                <ChartBar className="size-4" weight="duotone" />
                Usage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <SignOut className="size-4" weight="duotone" />
                Sign out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Dialogs */}
      <GitHubDialog
        open={isGitHubDialogOpen}
        onOpenChange={setIsGitHubDialogOpen}
        projectId={projectId}
      />
      <UsageDialog open={isUsageOpen} onOpenChange={setIsUsageOpen} />
      <DeploymentStatusDialog
        open={isDeploymentStatusOpen}
        onOpenChange={setIsDeploymentStatusOpen}
        projectId={projectId}
        worker={worker}
      />

      <Dialog
        open={isStripeSuccessOpen}
        onOpenChange={(open) => {
          setIsStripeSuccessOpen(open)
          if (!open) {
            setPulsePaymentsTab(true)
            setTimeout(() => setPulsePaymentsTab(false), 10000)
          }
        }}
      >
        <DialogContent overlayClassName="backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Stripe Connected Successfully!</DialogTitle>
            <DialogDescription>
              You can now head to the Payments tab to configure pricing and more.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsStripeSuccessOpen(false)
                setPulsePaymentsTab(true)
                setTimeout(() => setPulsePaymentsTab(false), 10000)
              }}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStripeConflictOpen} onOpenChange={setIsStripeConflictOpen}>
        <DialogContent overlayClassName="backdrop-blur-sm" className="sm:max-w-lg">
          <div className="flex flex-col items-center text-center pt-12 pb-2">
            {/* Radiating circles icon */}
            <div className="relative flex items-center justify-center mb-14">
              <div className="absolute size-28 rounded-full bg-brand/10" />
              <div className="absolute size-20 rounded-full bg-brand/20" />
              <div className="relative size-12 rounded-full bg-brand/30 border-2 border-brand/50 flex items-center justify-center">
                <span className="text-brand text-xl font-semibold">i</span>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-3">Move this Stripe account?</h2>
            <p className="text-sm text-muted-foreground mb-10">
              This Stripe account is currently connected to another project.
              <br />
              You can move it here, or use a different account instead.
            </p>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 h-10"
                disabled={surpayConnect.isPending}
                onClick={() => {
                  if (!projectId) return
                  surpayConnect.mutate(projectId, {
                    onSuccess: (data) => {
                      setIsStripeConflictOpen(false)
                      setConflictAccountId(null)
                      window.location.href = data.oauthUrl
                    },
                    onError: () =>
                      toast.error('Failed to start Stripe connection', { position: 'top-right' }),
                  })
                }}
              >
                {surpayConnect.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Use Different Account
              </Button>
              <Button
                className="flex-1 h-10 bg-brand hover:bg-brand/90 text-brand-foreground"
                disabled={surpayMoveAccount.isPending}
                onClick={() => {
                  if (!projectId || !conflictAccountId) return
                  surpayMoveAccount.mutate(
                    { accountId: conflictAccountId, projectId },
                    {
                      onSuccess: () => {
                        setIsStripeConflictOpen(false)
                        setConflictAccountId(null)
                        toast.success('Stripe account moved successfully', {
                          position: 'top-right',
                        })
                        setPulsePaymentsTab(true)
                        setTimeout(() => setPulsePaymentsTab(false), 10000)
                      },
                      onError: () =>
                        toast.error('Failed to move Stripe account', { position: 'top-right' }),
                    },
                  )
                }}
              >
                {surpayMoveAccount.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Move Here
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
