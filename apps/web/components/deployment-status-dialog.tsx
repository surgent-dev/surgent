'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Copy, PencilSimple, ArrowSquareOut, X, RocketLaunch } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'react-hot-toast'
import { useDeploymentHistoryQuery, useRedeployVersion, useDeployProject } from '@/queries/projects'
import DeployDialog from '@/components/deploy-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  worker?: { name: string; status: string | null; hostname: string | null } | null
}

const STATUS: Record<string, string> = {
  deployed: 'Deployed',
  building: 'Building',
  uploading: 'Uploading',
  starting: 'Starting',
  queued: 'Queued',
  deploy_failed: 'Failed',
  build_failed: 'Build failed',
}

const TERMINAL = ['deployed', 'deploy_failed', 'build_failed']

function timeAgo(d: string) {
  const now = Date.now()
  const then = new Date(d).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function duration(start?: string, end?: string) {
  if (!start || !end) return '—'
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function DeploymentStatusDialog({ open, onOpenChange, projectId, worker }: Props) {
  const [rollId, setRollId] = useState<string | null>(null)
  const [deployOpen, setDeployOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const prevStatusRef = useRef<string | null>(null)

  const { data: history, isLoading } = useDeploymentHistoryQuery(projectId, open)
  const redeploy = useRedeployVersion()
  const deploy = useDeployProject()

  const name = worker?.name
  const isLive = worker?.status === 'active'
  const latest = history?.[0]
  const busy = latest && !TERMINAL.includes(latest.status)

  // Toast when deployment completes
  useEffect(() => {
    if (!latest) return
    const prev = prevStatusRef.current
    const curr = latest.status

    if (prev && !TERMINAL.includes(prev) && TERMINAL.includes(curr)) {
      if (curr === 'deployed') {
        toast.success(`Deployed to ${latest.scriptName}.surgent.site`, { position: 'bottom-left' })
      } else {
        toast.error(`Deployment failed: ${latest.error || curr}`, { position: 'bottom-left' })
      }
    }
    prevStatusRef.current = curr
  }, [latest])

  const handleDeploy = (n: string) => {
    if (!projectId) return
    deploy.mutate(
      { id: projectId, deployName: n },
      {
        onSuccess: () => {
          setDeployOpen(false)
          setEditing(false)
        },
        onError: () => toast.error('Failed to start deployment'),
      },
    )
  }

  const handleRollback = (v: string) => {
    if (!projectId) return
    setRollId(v)
    redeploy.mutate(
      { id: projectId, versionId: v },
      {
        onSettled: () => setRollId(null),
        onSuccess: () => toast.success('Rollback started'),
        onError: () => toast.error('Rollback failed'),
      },
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl p-0 gap-0 [&>button]:hidden">
          {/* Header */}
          <div className="h-11 px-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`size-2 rounded-full ${isLive ? 'bg-emerald-500' : busy ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/30'}`}
              />
              <span className="text-sm font-medium">{isLive ? 'Live' : busy ? 'Deploying' : 'Offline'}</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Progress banner */}
          {latest && !['deployed'].includes(latest.status) && (
            <div
              className={`h-9 px-4 border-b flex items-center gap-2 text-sm ${TERMINAL.includes(latest.status) ? 'bg-destructive/5' : 'bg-brand/5'}`}
            >
              {TERMINAL.includes(latest.status) ? (
                <span className="size-1.5 rounded-full bg-destructive" />
              ) : (
                <Loader2 className="size-3 animate-spin text-brand" />
              )}
              <span className={TERMINAL.includes(latest.status) ? 'text-destructive' : 'text-muted-foreground'}>
                {STATUS[latest.status] || latest.status}
              </span>
              <span className="text-xs text-muted-foreground/60 font-mono">{latest.id.slice(0, 8)}</span>
              {latest.error && <span className="text-xs text-destructive/70 truncate flex-1">{latest.error}</span>}
            </div>
          )}

          {/* URL + Actions */}
          <div className="p-4 border-b space-y-3">
            {name && (
              <div className="flex items-center h-9 px-3 rounded-md border bg-muted/20 font-mono text-sm">
                {editing ? (
                  <>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDeploy(input.trim())
                        if (e.key === 'Escape') setEditing(false)
                      }}
                      className="flex-1 bg-transparent outline-none min-w-0"
                      autoFocus
                    />
                    <span className="text-muted-foreground/60 shrink-0">.surgent.site</span>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="ml-2 p-0.5 hover:bg-muted rounded"
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-muted-foreground">{name}.surgent.site</span>
                    <a
                      href={`https://${name}.surgent.site`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-muted rounded"
                    >
                      <ArrowSquareOut className="size-3.5 text-muted-foreground" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${name}.surgent.site`)
                        toast.success('Copied')
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Copy className="size-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInput(name)
                        setEditing(true)
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <PencilSimple className="size-3.5 text-muted-foreground" />
                    </button>
                  </>
                )}
              </div>
            )}
            <Button
              className="w-full h-9 bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={() => (editing ? handleDeploy(input.trim()) : name ? handleDeploy(name) : setDeployOpen(true))}
              disabled={deploy.isPending || Boolean(busy)}
            >
              {deploy.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <RocketLaunch className="size-4 mr-2" weight="fill" />
              )}
              {editing && input.trim() !== name ? 'Save & Publish' : name ? 'Republish' : 'Publish'}
            </Button>
          </div>

          {/* History header */}
          <div className="h-9 px-4 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
            <span className="font-medium">History</span>
            {history?.length ? <span>{history.length} deployments</span> : null}
          </div>

          {/* History list */}
          <ScrollArea className="h-56">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" /> Loading
              </div>
            ) : !history?.length ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No deployments yet
              </div>
            ) : (
              <div className="divide-y">
                {history.slice(0, 20).map((d, i) => {
                  const fail = d.status.includes('failed')
                  const pend = !TERMINAL.includes(d.status)
                  const ok = d.status === 'deployed'
                  return (
                    <div
                      key={d.id}
                      className={`px-4 py-2.5 flex items-start gap-3 text-sm ${i === 0 ? 'bg-muted/30' : 'hover:bg-muted/10'}`}
                    >
                      <span
                        className={`size-1.5 rounded-full mt-1.5 shrink-0 ${fail ? 'bg-destructive' : pend ? 'bg-amber-500' : ok ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${fail ? 'text-destructive' : pend ? 'text-amber-600 dark:text-amber-400' : ok ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                          >
                            {STATUS[d.status] || d.status}
                          </span>
                          <span className="text-xs text-muted-foreground/60 font-mono">{d.scriptName || '—'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(d.createdAt)} · {duration(d.startedAt, d.deployedAt)}
                          {d.error && <span className="text-destructive/70 ml-2">{d.error}</span>}
                        </div>
                      </div>
                      {ok && d.cloudflareVersionId && i > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRollback(d.cloudflareVersionId!)}
                          disabled={rollId === d.cloudflareVersionId}
                          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 shrink-0"
                        >
                          {rollId === d.cloudflareVersionId ? <Loader2 className="size-3 animate-spin" /> : 'Rollback'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        defaultName={name}
        onConfirm={handleDeploy}
        isSubmitting={deploy.isPending}
      />
    </>
  )
}
