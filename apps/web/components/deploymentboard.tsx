'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Rocket, ChevronUp, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import DeployDialog from '@/components/deploy-dialog'
import { useProjectQuery, useDeployProject, useUndeployProject, useDeploymentHistoryQuery } from '@/queries/projects'
import { toast } from 'react-hot-toast'

const DEPLOYMENT_IN_PROGRESS_STATUSES = ['queued', 'starting', 'building', 'uploading']

function formatRelativeTime(dateString?: string) {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatusBadgeVariant(status: string) {
  if (status === 'deployed') return 'default'
  if (status.includes('failed')) return 'destructive'
  return 'secondary'
}

interface DeploymentBoardProps {
  projectId: string
}

export default function DeploymentBoard({ projectId }: DeploymentBoardProps) {
  const router = useRouter()
  const { data: project, isLoading: projectLoading } = useProjectQuery(projectId)
  const { data: history = [], isLoading: historyLoading } = useDeploymentHistoryQuery(projectId)
  const deploy = useDeployProject()
  const undeploy = useUndeployProject()

  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false)
  const [dialogIntent, setDialogIntent] = useState<'deploy' | 'hostname'>('deploy')

  const deployment = project?.deployment
  const status = deployment?.status ?? ''
  const isInProgress = DEPLOYMENT_IN_PROGRESS_STATUSES.includes(status)

  const displayStatus =
    status === 'deployed'
      ? 'Deployed'
      : isInProgress
        ? 'Deploying'
        : status === 'idle' || status === 'undeployed'
          ? 'Inactive'
          : status

  const timeDisplay = isInProgress ? deployment?.startedAt : deployment?.deployedAt
  const hostname = deployment?.name ? `${deployment.name}.surgent.site` : null
  const previewUrl = deployment?.previewUrl

  const handleDeploy = () => {
    setIsDeployDialogOpen(true)
    setDialogIntent('deploy')
  }

  const handleChangeHostname = () => {
    setIsDeployDialogOpen(true)
    setDialogIntent('hostname')
  }

  const handleDeployConfirm = async (sanitizedName: string) => {
    if (!projectId) return
    if (dialogIntent === 'hostname') {
      deploy.mutate(
        { id: projectId, deployName: sanitizedName },
        {
          onSuccess: () => {
            toast.success('Hostname updated')
            setIsDeployDialogOpen(false)
          },
          onError: () => toast.error('Failed to update hostname'),
        },
      )
      return
    }
    deploy.mutate(
      { id: projectId, deployName: sanitizedName },
      {
        onSuccess: () => {
          toast.success('Deployment started')
          setIsDeployDialogOpen(false)
        },
        onError: () => toast.error('Failed to start deployment'),
      },
    )
  }

  const handleUndeploy = () => {
    if (!projectId) return
    undeploy.mutate(
      { id: projectId },
      {
        onSuccess: () => toast.success('Undeployed'),
        onError: () => toast.error('Failed to undeploy'),
      },
    )
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-medium">{project?.name || 'Project'}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="space-y-6">
          <div className="border rounded-lg p-6 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Deployment Status</h2>
                {timeDisplay && (
                  <p className="text-sm text-muted-foreground">
                    {isInProgress ? 'Started' : 'Deployed'} {formatRelativeTime(timeDisplay)}
                  </p>
                )}
              </div>
              <Badge variant={getStatusBadgeVariant(status)}>{displayStatus}</Badge>
            </div>

            {hostname && previewUrl && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Site:</span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleDeploy} disabled={deploy.isPending || isInProgress} className="cursor-pointer">
                <Rocket className="h-4 w-4 mr-2" />
                {deploy.isPending ? 'Deploying...' : 'Deploy'}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Actions <ChevronUp className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleChangeHostname}>Change Hostname</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDeploy} disabled={isInProgress}>
                    Deploy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleUndeploy} disabled={status !== 'deployed'}>
                    Undeploy
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="border rounded-lg bg-card">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Deployment History</h3>
            </div>
            {historyLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No deployment history</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Version ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.slice(0, 5).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">{item.versionId || '-'}</span>
                      </TableCell>
                      <TableCell>{formatRelativeTime(item.createdAt)}</TableCell>
                      <TableCell>
                        {item.startedAt && item.deployedAt
                          ? `${Math.round((new Date(item.deployedAt).getTime() - new Date(item.startedAt).getTime()) / 1000)}s`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>

      <DeployDialog
        open={isDeployDialogOpen}
        onOpenChange={setIsDeployDialogOpen}
        defaultName={deployment?.name}
        onConfirm={handleDeployConfirm}
        isSubmitting={deploy.isPending}
        intent={dialogIntent}
      />
    </div>
  )
}
