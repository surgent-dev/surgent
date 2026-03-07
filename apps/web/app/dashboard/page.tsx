'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  FolderOpen,
  Store,
  Loader2,
  AlertCircle,
  CreditCard,
} from 'lucide-react'
import { Lightning } from '@phosphor-icons/react'
import { useCredits } from '@/hooks/use-credits'
import PlanDialog from '@/components/plan-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useProjectsQuery, useRenameProject, useDeleteProject } from '@/queries/projects'
import type { Project } from '@/types/project'

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

// Deterministic soft color from project ID
function getProjectColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsla(${hue}, 40%, 60%, 0.1)`
}

function getProjectAccent(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 65%)`
}

// Format relative time
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Project Card
function ProjectCard({
  project,
  onRename,
  onDelete,
  onClick,
}: {
  project: Project
  onRename: () => void
  onDelete: () => void
  onClick: () => void
}) {
  const bgColor = getProjectColor(project.id)
  const accentColor = getProjectAccent(project.id)
  const initial = project.name.charAt(0).toUpperCase()
  const isLive = project.worker?.status === 'active' && project.worker?.hostname
  const isProvisioning = project.status === 'provisioning'
  const isFailed = project.status === 'failed'

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card overflow-hidden',
        'border-border/50 hover:border-border hover:shadow-sm',
        'cursor-pointer transition-shadow duration-200',
        isFailed && 'border-destructive/30',
      )}
    >
      <div
        className={cn(
          'relative h-36 sm:h-40 flex items-center justify-center',
          isProvisioning && 'animate-pulse',
        )}
        style={{ backgroundColor: bgColor }}
      >
        <span
          className={cn(
            'text-4xl sm:text-5xl font-semibold select-none',
            isProvisioning && 'opacity-40',
          )}
          style={{ color: accentColor }}
        >
          {initial}
        </span>

        {/* Status badge — only one at a time */}
        {isProvisioning ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 backdrop-blur-sm">
            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
            <span className="text-xs font-medium text-muted-foreground">Setting up</span>
          </div>
        ) : isFailed ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 backdrop-blur-sm">
            <AlertCircle className="w-3 h-3 text-destructive" />
            <span className="text-xs font-medium text-destructive">Failed</span>
          </div>
        ) : isLive ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs font-medium text-foreground">Live</span>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium text-foreground truncate">{project.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isFailed && project.failReason ? (
                <span className="text-destructive">{project.failReason}</span>
              ) : isProvisioning ? (
                project.metadata?.provisioningStep || 'Creating project...'
              ) : (
                formatRelativeDate(project.createdAt)
              )}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-lg',
                  'hover:bg-muted/80 transition-colors',
                )}
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {isLive && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`https://${project.worker!.hostname}`, '_blank')
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Visit site
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onRename()
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { data: projects = [], isLoading } = useProjectsQuery()
  const credits = useCredits()
  const rename = useRenameProject()
  const deleteProject = useDeleteProject()

  const [projectToRename, setProjectToRename] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    authClient.getSession().then(({ data, error }) => {
      if (error || !data?.user) {
        router.push('/login')
        return
      }
      setUser(data.user as User)
    })
  }, [router])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  const handleRename = useCallback(() => {
    if (!projectToRename || !newName.trim()) return
    rename.mutate(
      { id: projectToRename.id, name: newName.trim() },
      {
        onSuccess: () => {
          toast.success('Project renamed')
          setProjectToRename(null)
        },
        onError: () => toast.error('Failed to rename'),
      },
    )
  }, [projectToRename, newName, rename])

  const handleDelete = useCallback(() => {
    if (!projectToDelete) return
    deleteProject.mutate(
      { id: projectToDelete.id },
      {
        onSuccess: () => {
          toast.success('Project deleted')
          setProjectToDelete(null)
        },
        onError: () => toast.error('Failed to delete'),
      },
    )
  }, [projectToDelete, deleteProject])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="w-full px-6 h-14 flex items-center border-b border-border/50">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>
        <main className="max-w-6xl mx-auto py-8">
          <Skeleton className="h-9 w-40 mb-10" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
                <Skeleton className="h-40 rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full px-6 h-14 flex items-center border-b border-border/50">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/surgent-logo-dark.svg"
              alt="Surgent"
              width={119}
              height={32}
              className="h-7 w-auto"
              priority
            />
          </Link>

          <div className="flex items-center gap-3">
            {credits.hasCustomer && !credits.unlimited && (
              <button
                onClick={() => credits.setPlanDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/8 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/12 active:translate-y-px transition-all duration-100"
              >
                <Lightning className="size-3.5" weight="fill" />
                Upgrade
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-10 w-10 rounded-full ring-1 ring-border/60 hover:ring-border transition-all">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback className="text-sm bg-muted">
                      {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {credits.hasCustomer && !credits.unlimited && (
                  <>
                    <div className="px-3 py-2.5 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Credits</span>
                        <span className="text-xs tabular-nums font-medium">
                          {credits.used.toLocaleString()} / {credits.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            credits.usedPercent >= 90
                              ? 'bg-rose-500'
                              : credits.usedPercent >= 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${credits.usedPercent}%` }}
                        />
                      </div>
                      <button
                        onClick={() => credits.setPlanDialogOpen(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-brand/20 bg-brand/8 px-2.5 py-1.5 text-[11px] font-medium text-brand hover:bg-brand/12 active:translate-y-px transition-all duration-100"
                      >
                        <Lightning className="size-3" weight="fill" />
                        Upgrade
                      </button>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => credits.openBillingPortal()}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto py-8">
        {/* Title row */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Your Projects</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/marketplace')}
              className="gap-2 rounded-full"
            >
              <Store className="h-4 w-4" />
              Marketplace
            </Button>
            <Button onClick={() => router.push('/')} className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              New project
            </Button>
          </div>
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-medium mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-8 max-w-sm">
              Create your first project to start building with AI
            </p>
            <Button onClick={() => router.push('/')} className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project: Project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/project/${project.id}`)}
                onRename={() => {
                  setNewName(project.name)
                  setProjectToRename(project)
                }}
                onDelete={() => setProjectToDelete(project)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Rename Dialog */}
      <Dialog open={!!projectToRename} onOpenChange={(open) => !open && setProjectToRename(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setProjectToRename(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={rename.isPending || !newName.trim()}>
              {rename.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 mb-2">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This will permanently delete{' '}
            <span className="font-medium text-foreground">{projectToDelete?.name}</span> and all its
            data. This cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:gap-2 mt-2">
            <Button variant="outline" onClick={() => setProjectToDelete(null)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="flex-1"
            >
              {deleteProject.isPending ? 'Deleting...' : 'Delete project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanDialog open={credits.planDialogOpen} onOpenChange={credits.setPlanDialogOpen} />
    </div>
  )
}
