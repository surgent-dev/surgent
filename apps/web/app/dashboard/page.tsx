'use client'

import { FolderOpen, Loader2, Plus, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import BillingSyncBridge from '@/components/billing-sync-bridge'
import MigrationCreditBanner from '@/components/migration-credit-banner'
import PlanDialog from '@/components/plan-dialog'
import ReferralDialog from '@/components/referral-dialog'
import UserMenu from '@/components/project-header/user-menu'
import { SurgentLogo } from '@/components/surgent-logo'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useCredits } from '@/hooks/use-credits'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useDeleteProject, useProjectsQuery, useRenameProject } from '@/queries/projects'
import type { Project } from '@/types/project'

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

// Project item — just text
function ProjectItem({
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
  const isLive = project.worker?.status === 'active' && project.worker?.hostname
  const isProvisioning = project.status === 'provisioning'
  const isFailed = project.status === 'failed'

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-muted/40 cursor-pointer transition-colors"
    >
      {/* Status dot */}
      {isProvisioning ? (
        <Loader2 className="w-2.5 h-2.5 text-muted-foreground/30 animate-spin shrink-0" />
      ) : (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isFailed ? 'bg-destructive' : isLive ? 'bg-emerald-400' : 'bg-foreground/15',
          )}
        />
      )}

      {/* Name */}
      <span className="text-sm text-foreground/70 group-hover:text-foreground transition-colors truncate">
        {project.name}
      </span>

      {/* Date */}
      <span className="text-[11px] text-muted-foreground/25 shrink-0 hidden sm:block">
        {formatRelativeDate(project.createdAt)}
      </span>

      <span className="flex-1" />

      {/* Actions — plain text, appear on hover */}
      <span className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[11px]">
        {isLive && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.open(`https://${project.worker!.hostname}`, '_blank')
            }}
            className="text-muted-foreground/30 hover:text-foreground transition-colors cursor-pointer"
          >
            visit ↗
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRename()
          }}
          className="text-muted-foreground/30 hover:text-foreground transition-colors cursor-pointer"
        >
          rename
        </button>
        <span className="text-border">·</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
        >
          delete
        </button>
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: projects = [], isLoading } = useProjectsQuery()
  const credits = useCredits()
  const rename = useRenameProject()
  const deleteProject = useDeleteProject()

  const [projectToRename, setProjectToRename] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [newName, setNewName] = useState('')
  const [referralOpen, setReferralOpen] = useState(false)

  useEffect(() => {
    authClient.getSession().then(({ data, error }) => {
      if (error || !data?.user) {
        router.push('/login')
        return
      }
    })
  }, [router])

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
      <>
        <BillingSyncBridge />
        <div className="min-h-screen bg-white dark:bg-background">
          <header className="shrink-0 px-6 sm:px-10">
            <div className="flex items-center justify-between h-14 max-w-2xl w-full mx-auto">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </header>
          <div className="px-6 sm:px-10">
            <div className="max-w-2xl mx-auto py-10">
              <Skeleton className="h-6 w-28 mb-10" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <Skeleton className="w-1.5 h-1.5 rounded-full" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <BillingSyncBridge />
      <div className="min-h-screen bg-white dark:bg-background">
        {/* Header */}
        <header className="shrink-0 px-6 sm:px-10">
          <div className="flex items-center justify-between h-14 max-w-2xl w-full mx-auto">
            <Link href="/" className="text-foreground">
              <SurgentLogo className="text-[17px]" />
            </Link>
            <UserMenu onUpgrade={() => credits.setPlanDialogOpen(true)} />
          </div>
        </header>

        <MigrationCreditBanner onUpgrade={() => credits.setPlanDialogOpen(true)} />

        {/* Main */}
        <main className="px-6 sm:px-10">
          <div className="max-w-2xl mx-auto py-10">
            {/* Title row */}
            <div className="flex items-center justify-between mb-10">
              <h1 className="font-display text-2xl text-foreground">Your projects</h1>
              <button
                onClick={() => router.push('/get-started')}
                className="btn-brand-secondary inline-flex items-center gap-2 h-8 px-4 rounded-[0.5rem] text-xs font-medium cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                New project
              </button>
            </div>

            {/* Referral CTA */}
            <button
              onClick={() => setReferralOpen(true)}
              className="group w-full flex items-center gap-3 px-4 py-3 mb-8 rounded-lg border border-brand/20 bg-brand/[0.04] hover:bg-brand/[0.08] hover:border-brand/30 transition-all cursor-pointer text-left"
            >
              <div className="size-8 rounded-lg bg-brand/10 group-hover:bg-brand/15 flex items-center justify-center shrink-0 transition-colors">
                <UserPlus className="size-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">Get credits</p>
                <p className="text-[11px] text-muted-foreground/60">
                  Invite friends and earn $5 for each signup
                </p>
              </div>
              <span className="text-[12px] text-brand/60 group-hover:text-brand shrink-0 transition-colors">
                &rarr;
              </span>
            </button>

            {/* Projects list */}
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-5">
                  <FolderOpen className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <h2 className="text-base font-medium mb-1.5">No projects yet</h2>
                <p className="text-sm text-muted-foreground/50 mb-6 max-w-xs">
                  Create your first project to start building with AI
                </p>
                <button
                  onClick={() => router.push('/get-started')}
                  className="btn-brand inline-flex items-center gap-2 h-9 px-5 rounded-[0.5rem] text-sm font-medium cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create project
                </button>
              </div>
            ) : (
              <div>
                {projects.map((project: Project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    onClick={() => router.push(`/company/${project.id}/editor`)}
                    onRename={() => {
                      setNewName(project.name)
                      setProjectToRename(project)
                    }}
                    onDelete={() => setProjectToDelete(project)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Rename Dialog */}
        <Dialog open={!!projectToRename} onOpenChange={(open) => !open && setProjectToRename(null)}>
          <DialogContent className="sm:max-w-sm p-5 gap-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium">Rename project</DialogTitle>
            </DialogHeader>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setProjectToRename(null)}
                className="text-xs text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={rename.isPending || !newName.trim()}
                className="btn-brand-secondary inline-flex items-center h-8 px-4 rounded-[0.5rem] text-xs font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {rename.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
          <DialogContent className="sm:max-w-xs p-5 gap-3">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium">
                Delete {projectToDelete?.name}?
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground/50">This can&apos;t be undone.</p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setProjectToDelete(null)}
                className="text-xs text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteProject.isPending}
                className="inline-flex items-center h-8 px-4 rounded-[0.5rem] text-xs font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-destructive text-white hover:bg-destructive/90 transition-colors"
              >
                {deleteProject.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <PlanDialog open={credits.planDialogOpen} onOpenChange={credits.setPlanDialogOpen} />
        <ReferralDialog open={referralOpen} onOpenChange={setReferralOpen} />
      </div>
    </>
  )
}
