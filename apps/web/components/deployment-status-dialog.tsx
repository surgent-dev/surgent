'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Copy,
  PencilSimple,
  ArrowSquareOut,
  X,
  RocketLaunch,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { useDeploymentHistoryQuery, useRedeployVersion, useDeployProject } from '@/queries/projects'
import { DomainSearchPanel } from '@/components/domains/domain-search-panel'
import { useProjectDomains } from '@/queries/domains'
import { DEPLOYMENT_STATUS_LABELS, TERMINAL_DEPLOYMENT_STATUSES } from '@/lib/deployment'
import { timeAgoDetailed, timeAgoCompact } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  worker?: { name: string; status: string | null; hostname: string | null } | null
}

function duration(start?: string, end?: string) {
  if (!start || !end) return '—'
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function copyError(error: string) {
  navigator.clipboard.writeText(error)
  toast.success('Copied to clipboard')
}

export default function DeploymentStatusDialog({ open, onOpenChange, projectId, worker }: Props) {
  const queryClient = useQueryClient()
  const [rollId, setRollId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)

  const { data: history, isLoading } = useDeploymentHistoryQuery(projectId, open)
  const { data: domainsData } = useProjectDomains(projectId)
  const redeploy = useRedeployVersion()
  const deploy = useDeployProject()

  const name = worker?.name
  const isLive = worker?.status === 'active'
  const activeDomains = domainsData?.domains?.filter((d) => d.status === 'active') ?? []
  const hasCustomDomain = activeDomains.length > 0
  const latest = history?.[0]
  const busy = latest && !TERMINAL_DEPLOYMENT_STATUSES.includes(latest.status)

  // Toast when deployment completes
  useEffect(() => {
    if (!latest) return
    const prev = prevStatusRef.current
    const curr = latest.status

    if (
      prev &&
      !TERMINAL_DEPLOYMENT_STATUSES.includes(prev) &&
      TERMINAL_DEPLOYMENT_STATUSES.includes(curr)
    ) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      if (curr === 'deployed') {
        toast.success(`Deployed to ${latest.scriptName}.surgent.site`, { position: 'bottom-left' })
      } else if (curr !== 'cancelled') {
        toast.error(`Deployment failed: ${latest.error || curr}`, { position: 'bottom-left' })
      }
    }
    prevStatusRef.current = curr
  }, [latest, queryClient, projectId])

  const handleDeploy = (n: string) => {
    if (!projectId || !n) return
    deploy.mutate(
      { id: projectId, deployName: n },
      {
        onSuccess: () => setEditing(false),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to start deployment'),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="block sm:max-w-xl p-0 gap-0 [&>button]:hidden overflow-hidden">
        <div className="max-h-[85dvh] overflow-y-auto overflow-x-hidden min-w-0">
          {/* Header */}
          <div className="h-12 px-4 sm:px-5 border-b flex items-center justify-between sticky top-0 z-10 bg-background">
            <div className="flex items-center gap-2.5">
              <span
                className={`size-2 rounded-full shrink-0 ${isLive ? 'bg-emerald-500' : busy ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/30'}`}
              />
              <span className="text-sm font-semibold">
                {isLive ? 'Live' : busy ? 'Deploying' : 'Offline'}
              </span>
              {latest?.error && (
                <span className="text-xs text-destructive/70 truncate">{latest.error}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="size-7 flex items-center justify-center hover:bg-muted rounded-md transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Progress banner */}
          {latest && !['deployed'].includes(latest.status) && (
            <div
              className={`h-10 px-4 sm:px-5 border-b flex items-center gap-2 text-sm min-w-0 ${TERMINAL_DEPLOYMENT_STATUSES.includes(latest.status) ? 'bg-destructive/5' : 'bg-brand/5'}`}
            >
              {TERMINAL_DEPLOYMENT_STATUSES.includes(latest.status) ? (
                <span className="size-1.5 rounded-full bg-destructive shrink-0" />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-brand shrink-0" />
              )}
              <span
                className={`shrink-0 ${
                  TERMINAL_DEPLOYMENT_STATUSES.includes(latest.status)
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {DEPLOYMENT_STATUS_LABELS[latest.status] || latest.status}
              </span>
              <span className="text-xs text-muted-foreground/60 font-mono shrink-0">
                {latest.id.slice(0, 8)}
              </span>
              {latest.error && (
                <span className="text-xs text-destructive/70 truncate">{latest.error}</span>
              )}
            </div>
          )}

          {/* URL + Actions */}
          <div className="px-4 sm:px-5 py-4 border-b space-y-3">
            {/* Custom domains — shown as primary URLs when active */}
            {activeDomains.map((d) => (
              <div
                key={d.id}
                className="flex items-center h-10 px-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 font-mono text-sm min-w-0 overflow-hidden"
              >
                <span className="flex-1 truncate">{d.domainName}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {activeDomains.length > 1 && (
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full mr-1 ${
                        d.isPrimary
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {d.isPrimary ? 'PRIMARY' : 'ALIAS'}
                    </span>
                  )}
                  <a
                    href={`https://${d.domainName.replace(/^www\./, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-muted rounded"
                  >
                    <ArrowSquareOut className="size-3.5 text-muted-foreground" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://${d.domainName.replace(/^www\./, '')}`)
                      toast.success('Copied')
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <Copy className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}

            {/* Surgent subdomain — secondary when custom domain exists, editable only without custom domain */}
            {name && (
              <div
                className={`flex items-center h-10 px-3 rounded-lg border bg-muted/20 font-mono text-sm min-w-0 overflow-hidden ${hasCustomDomain ? 'opacity-50' : ''}`}
              >
                {editing && !hasCustomDomain ? (
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
                      className="ml-2 p-0.5 hover:bg-muted rounded shrink-0"
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-muted-foreground">
                      {name}.surgent.site
                    </span>
                    <div className="flex items-center shrink-0">
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
                      {/* Hide edit when custom domain is active */}
                      {!hasCustomDomain && (
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
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={() => handleDeploy(editing ? input.trim() : name || '')}
              disabled={deploy.isPending || Boolean(busy) || (!name && !editing)}
            >
              {deploy.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <RocketLaunch className="size-4 mr-2" weight="fill" />
              )}
              {editing && input.trim() !== name ? 'Save & Publish' : 'Republish'}
            </Button>
          </div>

          {/* Custom Domain */}
          {projectId && (
            <div className="border-b">
              <DomainSearchPanel
                projectId={projectId}
                hasDeployment={Boolean(worker?.name)}
                onDeploy={() => projectId && deploy.mutate({ id: projectId })}
              />
            </div>
          )}

          {/* History header */}
          <div className="h-10 px-4 sm:px-5 flex items-center justify-between text-xs text-muted-foreground border-b bg-muted/20">
            <span className="font-medium uppercase tracking-wider">Deployments</span>
            {history?.length ? <span>{history.length} total</span> : null}
          </div>

          {/* History list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" /> Loading
            </div>
          ) : !history?.length ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No deployments yet
            </div>
          ) : (
            <div className="divide-y">
              {history.slice(0, 20).map((d, i) => {
                const fail = d.status.includes('failed')
                const pend = !TERMINAL_DEPLOYMENT_STATUSES.includes(d.status)
                const ok = d.status === 'deployed'
                const snap = d.envSnapshot
                const varEntries = snap?.vars
                  ? Object.entries(snap.vars).sort(([a], [b]) => a.localeCompare(b))
                  : snap?.keys?.map((k) => [k, ''] as const) || []
                const isExpanded = expandedId === d.id
                const hasVals = Boolean(snap?.vars)
                return (
                  <div
                    key={d.id}
                    className={`px-4 sm:px-5 py-3 text-sm min-w-0 ${i === 0 ? 'bg-muted/20' : ''}`}
                  >
                    {/* Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <span
                          className={`size-2 rounded-full shrink-0 ${fail ? 'bg-destructive' : pend ? 'bg-amber-500' : ok ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <span
                              className={`font-medium shrink-0 ${fail ? 'text-destructive' : pend ? 'text-amber-600 dark:text-amber-400' : ok ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                            >
                              {DEPLOYMENT_STATUS_LABELS[d.status] || d.status}
                            </span>
                            <span className="text-xs text-muted-foreground/50 font-mono truncate min-w-0">
                              {d.scriptName || '—'}
                            </span>
                            <span className="text-[11px] text-muted-foreground/40 shrink-0 hidden sm:inline">
                              {timeAgoDetailed(d.createdAt)} · {duration(d.startedAt, d.deployedAt)}
                            </span>
                            <span className="text-[11px] text-muted-foreground/40 shrink-0 sm:hidden">
                              {timeAgoDetailed(d.createdAt)}
                            </span>
                            <span className="text-[11px] text-muted-foreground/40 shrink-0 sm:hidden">
                              {timeAgoCompact(d.createdAt)}
                            </span>
                          </div>
                          {d.error && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyError(d.error!)
                              }}
                              className="mt-1 flex items-center gap-1.5 text-[11px] text-destructive/70 hover:text-destructive transition-colors cursor-copy"
                            >
                              <span className="truncate max-w-[320px] font-mono">{d.error}</span>
                              <Copy className="size-3 shrink-0 opacity-50" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {varEntries.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : d.id)}
                            className={`h-7 px-1.5 sm:px-2 rounded-md text-xs inline-flex items-center gap-1 sm:gap-1.5 transition-colors ${isExpanded ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
                          >
                            {isExpanded ? (
                              <EyeSlash className="size-3.5" weight="bold" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                            <span className="tabular-nums hidden sm:inline">
                              {varEntries.length} env
                            </span>
                            <span className="tabular-nums sm:hidden">{varEntries.length}</span>
                          </button>
                        )}
                        {ok && d.cloudflareVersionId && i > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRollback(d.cloudflareVersionId!)}
                            disabled={rollId === d.cloudflareVersionId}
                            className="h-7 px-1.5 sm:px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-50 transition-colors"
                          >
                            {rollId === d.cloudflareVersionId ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              'Rollback'
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Env snapshot expanded */}
                    {isExpanded && varEntries.length > 0 && (
                      <div className="mt-3 sm:ml-5 rounded-lg border bg-muted/10 overflow-hidden">
                        <div className="grid grid-cols-[minmax(80px,auto)_1fr] sm:grid-cols-[minmax(120px,auto)_1fr] text-[11px] font-mono">
                          {varEntries.map(([k, v], idx) => (
                            <div
                              key={`${d.id}-${k}`}
                              className={`contents ${idx < varEntries.length - 1 ? '[&>*]:border-b' : ''}`}
                            >
                              <div className="px-2 sm:px-3 py-2 text-muted-foreground bg-muted/30 font-medium truncate">
                                {k}
                              </div>
                              <div className="px-2 sm:px-3 py-2 text-foreground/85 break-all">
                                {hasVals ? (
                                  v || (
                                    <span className="text-muted-foreground/40 italic">empty</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
