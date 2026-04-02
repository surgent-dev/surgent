'use client'

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  GitBranch,
  GitCommit,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { timeAgoCompact } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGitLog, useGitPull, useGitPush } from '@/queries/git'
import { useGitHubStatus } from '@/queries/github'

interface Props {
  projectId?: string
}

export default function GitPanel({ projectId }: Props) {
  const [open, setOpen] = useState(false)

  const { data: log, isLoading, refetch, isFetching } = useGitLog(projectId, { enabled: open })
  const { data: status } = useGitHubStatus(projectId, { enabled: open })
  const push = useGitPush()
  const pull = useGitPull()

  const connected = status?.connected
  const ahead = log?.ahead ?? 0
  const behind = log?.behind ?? 0
  const commits = log?.commits ?? []

  const handlePush = async () => {
    if (!projectId) return
    try {
      const res = await push.mutateAsync(projectId)
      if (res.success) {
        toast.success('Pushed!')
        refetch()
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
        refetch()
      } else {
        toast.error(res.error || 'Pull failed')
      }
    } catch {
      toast.error('Pull failed')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!projectId}>
          <GitCommit className="size-4" />
          Git
          {ahead > 0 && (
            <span className="flex items-center text-xs text-amber-500">
              <ArrowUp className="size-3" />
              {ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="flex items-center text-xs text-blue-500">
              <ArrowDown className="size-3" />
              {behind}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="end">
        {/* Header */}
        <div className="h-8 px-3 flex items-center justify-between border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <GitCommit className="size-4" />
            <span className="text-sm font-medium">Git</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          </Button>
        </div>

        {/* Branch */}
        {log?.initialized && (
          <div className="h-7 px-3 flex items-center justify-between border-b bg-muted/10 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="size-3" />
              {log.branch || 'main'}
            </span>
            {connected ? (
              ahead === 0 && behind === 0 ? (
                <span className="flex items-center gap-1 text-emerald-500">
                  <Check className="size-3" />
                  Synced
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {ahead > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-500">
                      <ArrowUp className="size-3" />
                      {ahead}
                    </span>
                  )}
                  {behind > 0 && (
                    <span className="flex items-center gap-0.5 text-blue-500">
                      <ArrowDown className="size-3" />
                      {behind}
                    </span>
                  )}
                </span>
              )
            ) : (
              <span className="text-muted-foreground">Local</span>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !log?.initialized ? (
          <div className="py-6 text-center">
            <AlertCircle className="size-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Git not initialized</p>
          </div>
        ) : commits.length === 0 ? (
          <div className="py-6 text-center">
            <GitCommit className="size-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No commits yet</p>
          </div>
        ) : (
          <ScrollArea className="h-52">
            <div className="p-1.5 space-y-0.5">
              {commits.map((c) => (
                <div
                  key={c.hash}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 text-xs"
                >
                  {c.pushed ? (
                    <Check className="size-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="size-3 text-amber-500 shrink-0" />
                  )}
                  <span className="font-mono text-muted-foreground w-12 shrink-0">
                    {c.shortHash}
                  </span>
                  <span className="truncate flex-1">{c.message}</span>
                  <span className="text-muted-foreground shrink-0">{timeAgoCompact(c.date)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Actions */}
        {log?.initialized && connected && (
          <div className="p-2 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handlePush}
              disabled={push.isPending || ahead === 0}
            >
              {push.isPending ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <ArrowUp className="size-3 mr-1" />
              )}
              Push{ahead > 0 && ` (${ahead})`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handlePull}
              disabled={pull.isPending || behind === 0}
            >
              {pull.isPending ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <ArrowDown className="size-3 mr-1" />
              )}
              Pull{behind > 0 && ` (${behind})`}
            </Button>
          </div>
        )}

        {log?.initialized && !connected && (
          <div className="p-2 border-t text-center text-xs text-muted-foreground">
            Connect GitHub to sync
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
