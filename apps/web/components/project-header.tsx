'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft,
  Rocket,
  Pencil,
  ExternalLink,
  Download,
  Loader2,
  AlertTriangle,
  X,
  Github,
  ChevronDown,
  Settings,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { authClient } from '@/lib/auth-client'
import {
  useConfirmHostname,
  useDeployProject,
  useRenameProject,
  useCloudflareDeploymentsQuery,
  useRedeployVersion,
  type CloudflareDeployment,
} from '@/queries/projects'
import { http } from '@/lib/http'
import DeployDialog from '@/components/deploy-dialog'
import GitHubDialog from '@/components/github-dialog'
import { useCustomer, usePricingTable } from 'autumn-js/react'
import { useGitHubStatus } from '@/queries/github'

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
    deployment?: {
      name?: string
      status?: string
      error?: string
      previewUrl?: string
    }
  }
}

export default function ProjectHeader({ projectId, project }: ProjectHeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const deployProject = useDeployProject()
  const confirmHostname = useConfirmHostname()
  const renameProject = useRenameProject()
  const { customer, check } = useCustomer()
  const { products } = usePricingTable()
  const [isCheckingAccess, setIsCheckingAccess] = useState(false)
  const [isPaywallOpen, setIsPaywallOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false)
  const [isDeploymentSuccessOpen, setIsDeploymentSuccessOpen] = useState(false)
  const [deployedHostname, setDeployedHostname] = useState<string | null>(null)
  const [redeployingVersionId, setRedeployingVersionId] = useState<string | null>(null)
  const { data: githubStatus } = useGitHubStatus(projectId, {
    enabled: isGitHubDialogOpen,
  })
  const {
    data: deployments,
    isLoading: isLoadingDeployments,
    error: deploymentsError,
  } = useCloudflareDeploymentsQuery(projectId || '')
  const redeployVersion = useRedeployVersion()

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setUser(data.user as User)
    })
  }, [])

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

  const deployment = project?.deployment
  const deploymentName = deployment?.name
  const status = deployment?.status ?? ''
  const isInProgress = ['queued', 'starting', 'building', 'uploading'].includes(status)
  const isFailed = status.includes('failed')
  const errorMsg = isFailed ? deployment?.error || status : null

  const handleConfirmDeploy = useCallback(
    async (name: string) => {
      if (!projectId || isDeploying) return
      setIsDeploying(true)
      const isHostnameChange = Boolean(deploymentName) && name !== deploymentName
      if (isHostnameChange) {
        confirmHostname.mutate(
          { id: projectId, name },
          {
            onSuccess: () => {
              setIsDialogOpen(false)
              toast.success('Hostname updated')
              setIsDeploying(false)
              setDeployedHostname(name)
              setIsDeploymentSuccessOpen(true)
            },
            onError: () => {
              toast.error('Failed to update hostname')
              setIsDeploying(false)
            },
          },
        )
        return
      }
      deployProject.mutate(
        { id: projectId, deployName: name },
        {
          onSuccess: () => {
            setIsDialogOpen(false)
            toast.success('Deployment started!')
            setIsDeploying(false)
            setDeployedHostname(name)
            setIsDeploymentSuccessOpen(true)
          },
          onError: () => {
            toast.error('Failed to start deployment')
            setIsDeploying(false)
          },
        },
      )
    },
    [confirmHostname, deployProject, deploymentName, isDeploying, projectId],
  )

  const handlePublishClick = useCallback(() => {
    if (!projectId) return

    if (status === 'deployed' && deploymentName) {
      setIsDeploying(true)
      deployProject.mutate(
        { id: projectId, deployName: deploymentName },
        {
          onSuccess: () => {
            toast.success('Redeployment started')
            setIsDeploying(false)
            setDeployedHostname(deploymentName)
            setIsDeploymentSuccessOpen(true)
          },
          onError: () => {
            toast.error('Failed to start deployment')
            setIsDeploying(false)
          },
        },
      )
      return
    }
    setIsDialogOpen(true)
  }, [projectId, status, deploymentName, deployProject])

  const performDownload = useCallback(async () => {
    if (!projectId) return
    setDownloading(true)
    try {
      const response = await http.get(`api/projects/${projectId}/download`, { timeout: 120000 })
      const blob = await response.blob()

      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="(.+)"/)
      const filename = match?.[1] || `${project?.name || 'project'}.tar.gz`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Download failed')
    } finally {
      setDownloading(false)
    }
  }, [projectId, project?.name])

  const handleDownloadClick = useCallback(() => {
    if (downloading || !projectId) return
    performDownload()
  }, [downloading, projectId, performDownload])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleRedeploy = (versionId: string) => {
    if (!projectId || redeployingVersionId) return
    setRedeployingVersionId(versionId)
    redeployVersion.mutate(
      { id: projectId, versionId },
      {
        onSuccess: () => {
          toast.success('Redeployment started')
          setRedeployingVersionId(null)
        },
        onError: () => {
          toast.error('Failed to start redeployment')
          setRedeployingVersionId(null)
        },
      },
    )
  }

  const sortedDeployments =
    deployments?.slice(0, 10).sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime()) || []

  return (
    <>
      {/* Warning banner */}
      {!bannerDismissed && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-foreground">
              <span className="font-medium">Heads up!</span> Projects may be deleted after inactivity. Download your
              code to keep it safe.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadClick}
              disabled={downloading}
              className="h-7 text-xs text-warning hover:bg-warning/20"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Download now
            </Button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded hover:bg-warning/20 text-warning transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <header className="h-12 flex items-center justify-between px-4 bg-background border-b shrink-0">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {isEditing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              className="h-7 px-2 text-sm font-medium rounded-md border border-input bg-background shadow-xs outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px] w-44 transition-shadow"
              autoFocus
            />
          ) : (
            <button
              onClick={handleStartEdit}
              className="group flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              {project?.name || 'Untitled Project'}
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {(status || isFailed) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`h-3 w-3 rounded-full ${status === 'deployed' ? 'bg-success' : isFailed ? 'bg-danger' : status ? 'bg-warning animate-pulse' : 'border-2 border-muted'}`}
              />
              {status === 'deployed' ? 'Live' : isFailed ? 'Failed' : status ? 'Deploying' : 'Inactive'}
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={githubStatus?.connected ? 'default' : 'outline'}
                size="sm"
                className={githubStatus?.connected ? 'bg-[#24292f] hover:bg-[#24292f]/90 text-white' : ''}
                onClick={() => setIsGitHubDialogOpen(true)}
                disabled={!projectId}
              >
                <Github className="h-4 w-4" />
                {githubStatus?.connected ? 'Synced' : 'GitHub'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {githubStatus?.connected
                ? `Connected to ${githubStatus.repo?.fullName}`
                : githubStatus?.installed
                  ? 'Connect to a GitHub repository'
                  : 'Push code to GitHub'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-brand hover:bg-brand/90 text-brand-foreground gap-1"
                    disabled={!projectId || isDeploying || isInProgress}
                  >
                    <Rocket className="h-4 w-4" />
                    {isInProgress ? 'Publishing...' : 'Publish'}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePublishClick}>
                    <Rocket className="h-4 w-4 mr-2" />
                    {status === 'deployed' ? 'Publish' : 'Publish'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => projectId && router.push(`/deploymentboard/${projectId}`)}
                    disabled={!projectId}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadClick} disabled={!projectId || downloading}>
                    {downloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download Code
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Clock className="h-4 w-4 mr-2" />
                      Deploy History
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-80 max-h-96 overflow-y-auto">
                      {isLoadingDeployments ? (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading deployments...
                        </div>
                      ) : deploymentsError ? (
                        <div className="py-8 text-sm text-center text-muted-foreground">Failed to load deployments</div>
                      ) : sortedDeployments.length === 0 ? (
                        <div className="py-8 text-sm text-center text-muted-foreground">No deployments yet</div>
                      ) : (
                        sortedDeployments.map((deployment: CloudflareDeployment) => (
                          <div key={deployment.id} className="flex flex-col p-2 hover:bg-muted">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-mono text-muted-foreground truncate">
                                  {deployment.version_id.slice(0, 12)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(deployment.created_on)}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={() => handleRedeploy(deployment.version_id)}
                                disabled={redeployingVersionId === deployment.version_id}
                              >
                                {redeployingVersionId === deployment.version_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Redeploy
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            {errorMsg && <TooltipContent>{errorMsg}</TooltipContent>}
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.image} alt={user?.name || user?.email} />
                  <AvatarFallback className="bg-brand text-brand-foreground text-sm font-medium">
                    {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="py-3">
                <div className="flex flex-col space-y-1">
                  <span className="font-medium text-base">{user?.name || user?.email}</span>
                  {customer && (
                    <span className="text-xs rounded-full bg-muted px-2 py-0.5 w-fit text-brand font-semibold mt-1">
                      {products?.find((p) => p.scenario === 'active')?.name || 'Free'} Plan
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <DeployDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        defaultName={deploymentName}
        onConfirm={handleConfirmDeploy}
        isSubmitting={isDeploying}
      />

      <GitHubDialog open={isGitHubDialogOpen} onOpenChange={setIsGitHubDialogOpen} projectId={projectId} />

      <Dialog open={isDeploymentSuccessOpen} onOpenChange={setIsDeploymentSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deployment Successful</DialogTitle>
            <DialogDescription>{deployedHostname} has been deployed</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsDeploymentSuccessOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
