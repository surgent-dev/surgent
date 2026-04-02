'use client'

import { Check, ExternalLink, Github, Loader2, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { timeAgoCompact } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGitCommit, useGitLog, useGitPull, useGitPush, useGitStatus } from '@/queries/git'
import {
  useGitHubCreateRepo,
  useGitHubDisconnect,
  useGitHubInstallUrl,
  useGitHubStatus,
} from '@/queries/github'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
}

export default function GitHubDialog({ open, onOpenChange, projectId }: Props) {
  const [repoName, setRepoName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [installationId, setInstallationId] = useState<number | null>(null)
  const [commitMessage, setCommitMessage] = useState('')

  // Queries
  const { data: status, isLoading } = useGitHubStatus(projectId, { enabled: open })
  const {
    data: installUrl,
    refetch: fetchInstallUrl,
    isFetching: fetchingUrl,
  } = useGitHubInstallUrl(projectId, { enabled: false })
  const {
    data: gitLog,
    isLoading: loadingLog,
    refetch: refetchLog,
  } = useGitLog(projectId, {
    enabled: open && status?.connected,
    fetch: true,
  })
  const { data: gitStatus, refetch: refetchStatus } = useGitStatus(projectId, {
    enabled: open && status?.connected,
  })

  // Mutations
  const create = useGitHubCreateRepo()
  const disconnect = useGitHubDisconnect()
  const push = useGitPush()
  const pull = useGitPull()
  const commit = useGitCommit()

  // Derived state
  const installations = useMemo(() => status?.installations ?? [], [status?.installations])
  const connected = status?.connected
  const installed = status?.installed
  const hasToken = status?.hasToken ?? false
  const commits = gitLog?.commits ?? []
  const branch = gitLog?.branch || 'main'
  const unpushed = commits.filter((c) => !c.pushed).length
  const behind = gitLog?.behind ?? 0
  const staged = gitStatus?.staged?.length ?? 0
  const unstaged = gitStatus?.unstaged?.length ?? 0
  const untracked = gitStatus?.untracked?.length ?? 0
  const changeCount = staged + unstaged + untracked
  const hasChanges = changeCount > 0

  const selectedInstallationId = installationId ?? installations[0]?.id ?? null

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setRepoName('')
      setDescription('')
      setIsPrivate(false)
      setInstallationId(null)
      setCommitMessage('')
    }
    onOpenChange(nextOpen)
  }

  // Handlers
  const goToInstall = async () => {
    const url = installUrl?.url || (await fetchInstallUrl()).data?.url
    if (url) window.location.href = url
  }

  const handleCreate = async () => {
    if (!projectId || !repoName.trim()) return
    try {
      const res = await create.mutateAsync({
        projectId,
        name: repoName,
        description,
        private: isPrivate,
        installationId: selectedInstallationId ?? undefined,
      })
      if (res.success) {
        toast.success('Repository created!')
        refetchLog()
      } else {
        toast.error(res.error || 'Failed')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const handlePush = async () => {
    if (!projectId) return
    try {
      const res = await push.mutateAsync(projectId)
      if (res.success) {
        toast.success('Pushed!')
        refetchLog()
        refetchStatus()
      } else {
        toast.error(res.error || 'Push failed')
      }
    } catch {
      toast.error('Push failed')
    }
  }

  const handlePull = async () => {
    if (!projectId) return
    try {
      const res = await pull.mutateAsync(projectId)
      if (res.success) {
        toast.success('Pulled!')
        refetchLog()
        refetchStatus()
      } else {
        toast.error(res.error || 'Pull failed')
      }
    } catch {
      toast.error('Pull failed')
    }
  }

  const handleCommit = async () => {
    if (!projectId || !commitMessage.trim()) return
    try {
      const res = await commit.mutateAsync({ projectId, message: commitMessage.trim() })
      if (res.success) {
        toast.success('Committed!')
        setCommitMessage('')
        refetchLog()
        refetchStatus()
      } else {
        toast.error(res.error || 'Commit failed')
      }
    } catch {
      toast.error('Commit failed')
    }
  }

  const handleDisconnect = async () => {
    if (!projectId) return
    try {
      await disconnect.mutateAsync(projectId)
      toast.success('Disconnected')
    } catch {
      toast.error('Failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="h-11 px-4 flex items-center justify-between border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2 font-medium">
            <Github className="size-4" />
            GitHub
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !installed ? (
          <div className="py-12 px-6 text-center space-y-4">
            <Github className="size-10 mx-auto text-muted-foreground/30" />
            <div>
              <p className="font-medium">Connect to GitHub</p>
              <p className="text-sm text-muted-foreground">Sync your code with a repository</p>
            </div>
            <Button onClick={goToInstall} disabled={fetchingUrl}>
              {fetchingUrl && <Loader2 className="size-4 animate-spin mr-2" />}
              Install GitHub App
            </Button>
          </div>
        ) : !connected ? (
          <div className="p-4 space-y-4">
            {installations.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Account</Label>
                <Select
                  value={selectedInstallationId ? String(selectedInstallationId) : ''}
                  onValueChange={(v) => setInstallationId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {installations.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.account}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Repository name</Label>
              <Input
                placeholder="my-project"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                placeholder="A short description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Private</Label>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <Button
              onClick={handleCreate}
              disabled={!repoName.trim() || create.isPending || !hasToken}
              className="w-full"
            >
              {create.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Create Repository
            </Button>

            {!hasToken && (
              <p className="text-center text-sm text-amber-600">
                <button onClick={goToInstall} className="underline">
                  Authorize
                </button>{' '}
                to continue
              </p>
            )}

            <button
              onClick={goToInstall}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3 inline mr-1" />
              Add account
            </button>
          </div>
        ) : (
          // Connected
          <>
            {/* Repo */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <a
                  href={`https://github.com/${status.repo?.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                >
                  {status.repo?.fullName}
                  <ExternalLink className="size-3 opacity-50" />
                </a>
                <p className="text-xs text-muted-foreground">{branch}</p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                {disconnect.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Disconnect'}
              </button>
            </div>

            {loadingLog ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Commits */}
                <div className="min-h-[100px] max-h-[180px] overflow-y-auto py-2">
                  {commits.length > 0 ? (
                    commits.slice(0, 10).map((c) => (
                      <div key={c.hash} className="px-4 py-1.5 flex items-center gap-2.5 text-sm">
                        <span
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            c.pushed ? 'bg-emerald-500' : 'bg-amber-500',
                          )}
                        />
                        <span className="truncate flex-1">{c.message}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgoCompact(c.date)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
                      No commits yet
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 pt-3 border-t space-y-3">
                  {hasChanges ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-600">
                        {changeCount} unsaved {changeCount === 1 ? 'change' : 'changes'}
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          placeholder="What changed?"
                          className="h-9"
                          onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                        />
                        <Button
                          className="h-9"
                          onClick={handleCommit}
                          disabled={!commitMessage.trim() || commit.isPending}
                        >
                          {commit.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">
                      {unpushed === 0 && behind === 0 ? (
                        <span className="text-emerald-600 flex items-center gap-1.5">
                          <Check className="size-4" />
                          Synced
                        </span>
                      ) : (
                        <>
                          {unpushed > 0 && (
                            <span className="text-amber-600">{unpushed} to push</span>
                          )}
                          {unpushed > 0 && behind > 0 && (
                            <span className="text-muted-foreground mx-1">·</span>
                          )}
                          {behind > 0 && <span className="text-blue-600">{behind} to pull</span>}
                        </>
                      )}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-9"
                      onClick={handlePull}
                      disabled={pull.isPending || behind === 0}
                    >
                      {pull.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                      Pull
                    </Button>
                    <Button
                      className="flex-1 h-9"
                      onClick={handlePush}
                      disabled={push.isPending || unpushed === 0 || hasChanges}
                    >
                      {push.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                      Push
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
