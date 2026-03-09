'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Globe,
  ArrowSquareOut,
  Trash,
  ShoppingCart,
  ArrowClockwise,
  Warning,
  Link,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Copy,
  Sparkle,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { showEntri, purchaseDomain, type EntriConfig } from 'entrijs'
import { toast } from 'react-hot-toast'
import {
  useInitDomainPurchase,
  useInitDomainConnect,
  useRetryDomainConnect,
  useProjectDomains,
  useOnDomainPurchased,
  useRemoveDomain,
  type DomainLogEntry,
} from '@/queries/domains'

// ─── Status config ──────────────────────────────────────────────
const statusConfig = {
  active: {
    label: 'Live',
    color: 'emerald',
    bg: 'bg-emerald-500/6 border-emerald-500/20',
    description: 'Your domain is live and serving traffic.',
  },
  ssl_provisioning: {
    label: 'Provisioning SSL',
    color: 'brand',
    bg: 'bg-brand/5 border-brand/20',
    description: 'Setting up HTTPS certificate. This usually takes a few seconds.',
  },
  dns_configuring: {
    label: 'Configuring DNS',
    color: 'amber',
    bg: 'bg-amber-500/6 border-amber-500/20',
    description: 'Waiting for DNS records to propagate.',
  },
  purchasing: {
    label: 'Purchasing',
    color: 'amber',
    bg: 'bg-amber-500/6 border-amber-500/20',
    description: 'Your domain purchase is being processed.',
  },
  pending: {
    label: 'Pending',
    color: 'amber',
    bg: 'bg-amber-500/6 border-amber-500/20',
    description: 'Waiting for confirmation.',
  },
  error: {
    label: 'Failed',
    color: 'red',
    bg: 'bg-red-500/6 border-red-500/20',
    description: 'Something went wrong. You can retry or remove this domain.',
  },
  awaiting: {
    label: 'Setting up',
    color: 'brand',
    bg: 'bg-brand/5 border-brand/20',
    description: 'Waiting for domain setup to complete.',
  },
} as const

const dotColor: Record<string, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  brand: 'bg-brand',
}

const textColor: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-500',
  brand: 'text-brand',
}

// ─── Progress steps ─────────────────────────────────────────────
const STEPS = [
  { key: 'dns', label: 'DNS' },
  { key: 'ssl', label: 'SSL' },
  { key: 'live', label: 'Live' },
] as const

function getActiveStep(status: string) {
  if (status === 'active') return 3
  if (status === 'ssl_provisioning') return 2
  if (status === 'dns_configuring') return 1
  if (status === 'purchasing' || status === 'pending') return 0
  return -1
}

function ProgressSteps({ status }: { status: string }) {
  const active = getActiveStep(status)
  if (active < 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((step, i) => {
        const done = i < active
        const current = i === active - 1 && status !== 'active'
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div
                className={`w-4 h-px transition-colors ${done ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`}
              />
            )}
            <div className="flex items-center gap-1">
              <div
                className={`size-1.5 rounded-full transition-colors ${
                  done
                    ? 'bg-emerald-500'
                    : current
                      ? 'bg-brand animate-pulse'
                      : 'bg-muted-foreground/20'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  done
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : current
                      ? 'text-brand'
                      : 'text-muted-foreground/40'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Activity log ───────────────────────────────────────────────
function DomainLogs({ logs }: { logs?: DomainLogEntry[] }) {
  if (!logs?.length) return null

  return (
    <details className="group">
      <summary className="text-[11px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground select-none transition-colors">
        Activity ({logs.length})
      </summary>
      <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin">
        {logs.map((entry, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80">
            {entry.success === true ? (
              <CheckCircle className="size-3 text-emerald-500 shrink-0 mt-0.5" weight="fill" />
            ) : entry.success === false ? (
              <XCircle className="size-3 text-red-500 shrink-0 mt-0.5" weight="fill" />
            ) : (
              <Clock className="size-3 text-muted-foreground/40 shrink-0 mt-0.5" weight="fill" />
            )}
            <span className="flex-1 break-words">{entry.detail || entry.event}</span>
            <span className="text-muted-foreground/40 shrink-0 tabular-nums">
              {new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

// ─── Domain status card ─────────────────────────────────────────
function DomainStatusCard({
  domainName,
  status,
  isStale,
  lastError,
  logs,
  onVisit,
  onRetry,
  onRemove,
  retrying,
  removing,
}: {
  domainName: string
  status: keyof typeof statusConfig
  isStale?: boolean
  lastError?: string | null
  logs?: DomainLogEntry[]
  onVisit?: string
  onRetry?: () => void
  onRemove?: () => void
  retrying?: boolean
  removing?: boolean
}) {
  const cfg = statusConfig[status]
  const isPending = status === 'pending' || status === 'purchasing'
  const isActive = status === 'active'
  const isError = status === 'error'
  const isProvisioning = status === 'ssl_provisioning'
  const isInProgress =
    isPending || isProvisioning || status === 'dns_configuring' || status === 'awaiting'
  const showSpinner = isInProgress && !isStale

  return (
    <div className="space-y-2">
      {/* Main card */}
      <div className={`rounded-lg border ${cfg.bg} overflow-hidden transition-all`}>
        {/* Domain name row */}
        <div className="flex items-center gap-2 h-10 px-3 min-w-0 overflow-hidden">
          {showSpinner ? (
            <Loader2 className={`size-3.5 animate-spin ${textColor[cfg.color]} shrink-0`} />
          ) : isStale ? (
            <Warning className="size-3.5 text-amber-500 shrink-0" weight="fill" />
          ) : isActive ? (
            <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" weight="fill" />
          ) : (
            <span className={`size-2 rounded-full shrink-0 ${dotColor[cfg.color]} animate-pulse`} />
          )}

          <span className="flex-1 truncate font-mono text-sm">
            {domainName === 'pending' ? 'Processing...' : domainName}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-[11px] font-medium ${textColor[cfg.color]}`}>
              {isStale ? 'Stuck' : cfg.label}
            </span>
            {isActive && onVisit && (
              <>
                <a
                  href={onVisit}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Visit"
                >
                  <ArrowSquareOut className="size-3.5 text-muted-foreground" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(onVisit)
                    toast.success('URL copied')
                  }}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Copy URL"
                >
                  <Copy className="size-3.5 text-muted-foreground" />
                </button>
              </>
            )}
            {onRemove && !isInProgress && (
              <button
                type="button"
                onClick={onRemove}
                disabled={removing}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                title="Remove domain"
              >
                <Trash className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for in-progress states */}
        {isInProgress && !isStale && (
          <div className="px-3 pb-2.5">
            <ProgressSteps status={status} />
          </div>
        )}
      </div>

      {/* Description for non-active states */}
      {!isActive && !isError && !isStale && (
        <p className="text-[11px] text-muted-foreground/60 px-0.5">{cfg.description}</p>
      )}

      {/* Error message */}
      {lastError && (
        <p className="text-[11px] text-red-500/80 bg-red-500/5 px-2.5 py-1.5 rounded-md">
          {lastError}
        </p>
      )}

      {/* Stale hint */}
      {isStale && !lastError && (
        <p className="text-[11px] text-amber-600/80 px-0.5">
          DNS not configured yet. Retry to re-open the setup wizard.
        </p>
      )}

      {/* Activity logs */}
      <DomainLogs logs={logs} />

      {/* Action buttons */}
      {(onRetry || (onRemove && (isError || isStale))) && (
        <div className="flex gap-2">
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="size-3 animate-spin mr-1.5" />
              ) : (
                <ArrowClockwise className="size-3 mr-1.5" weight="bold" />
              )}
              {isError ? (lastError?.includes('SSL') ? 'Retry SSL' : 'Retry') : 'Retry DNS'}
            </Button>
          )}
          {onRemove && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              disabled={removing}
            >
              <Trash className="size-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ─────────────────────────────────────────────────
interface DomainSearchPanelProps {
  projectId: string
}

export function DomainSearchPanel({ projectId }: DomainSearchPanelProps) {
  const [mode, setMode] = useState<'buy' | 'connect'>('connect')
  const [launching, setLaunching] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectInput, setConnectInput] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [awaitingWebhook, setAwaitingWebhook] = useState(false)
  const awaitingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { data: domainsData, isLoading: domainsLoading } = useProjectDomains(
    projectId,
    awaitingWebhook,
  )
  const initPurchase = useInitDomainPurchase()
  const initConnect = useInitDomainConnect()
  const retryConnect = useRetryDomainConnect()
  const removeDomain = useRemoveDomain()
  const onPurchased = useOnDomainPurchased()

  const activeDomain = domainsData?.domains?.find((d) => d.status === 'active')
  const provisioningDomain = domainsData?.domains?.find((d) => d.status === 'ssl_provisioning')
  const configuringDomain = domainsData?.domains?.find((d) => d.status === 'dns_configuring')
  const pendingDomain = domainsData?.domains?.find((d) =>
    ['pending', 'purchasing'].includes(d.status),
  )
  const errorDomain = domainsData?.domains?.find((d) => d.status === 'error')
  const currentDomain =
    activeDomain || provisioningDomain || configuringDomain || errorDomain || pendingDomain

  const isConfigStale = useMemo(() => {
    if (!configuringDomain) return false
    return Date.now() - new Date(configuringDomain.createdAt).getTime() > 5 * 60 * 1000
  }, [configuringDomain])

  useEffect(() => {
    if (
      awaitingWebhook &&
      (activeDomain || provisioningDomain || configuringDomain || pendingDomain)
    ) {
      setAwaitingWebhook(false)
      clearTimeout(awaitingTimerRef.current)
    }
  }, [awaitingWebhook, activeDomain, provisioningDomain, configuringDomain, pendingDomain])

  const startAwaitingWebhook = useCallback(() => {
    clearTimeout(awaitingTimerRef.current)
    setAwaitingWebhook(true)
    awaitingTimerRef.current = setTimeout(() => setAwaitingWebhook(false), 30_000)
  }, [])

  useEffect(() => () => clearTimeout(awaitingTimerRef.current), [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.success && detail?.domain) {
        onPurchased(projectId, detail.domain)
        startAwaitingWebhook()
      }
    }
    window.addEventListener('onEntriClose', handler)
    return () => window.removeEventListener('onEntriClose', handler)
  }, [projectId, onPurchased, startAwaitingWebhook])

  const handleBuyDomain = useCallback(
    async (free?: boolean) => {
      setLaunching(true)
      try {
        const config = await initPurchase.mutateAsync({ projectId })

        if ('provider' in config && config.provider === 'namecheap') {
          onPurchased(projectId, 'domainName' in config ? String(config.domainName) : '')
          return
        }
        if (config.devMode) return

        const sellConfig: EntriConfig = {
          applicationId: config.applicationId,
          token: config.token,
          dnsRecords: config.dnsRecords,
          userId: JSON.stringify({ projectId, email: config.contact.email }),
          whiteLabel: { sell: { contact: config.contact } },
          power: true,
          ...(free && { freeDomain: true }),
        }
        await purchaseDomain(sellConfig)
        startAwaitingWebhook()
      } finally {
        setLaunching(false)
      }
    },
    [projectId, initPurchase, startAwaitingWebhook, onPurchased],
  )

  const handleConnect = useCallback(async () => {
    if (!connectInput.trim()) return
    setConnecting(true)
    try {
      const config = await initConnect.mutateAsync({ projectId, domain: connectInput.trim() })
      try {
        await showEntri({
          applicationId: config.applicationId,
          token: config.token,
          prefilledDomain: config.prefilledDomain,
          dnsRecords: config.dnsRecords,
          userId: config.userId,
          power: true,
        })
      } catch (entriErr) {
        console.error('Entri Connect error:', entriErr)
      }
      startAwaitingWebhook()
      setConnectInput('')
    } finally {
      setConnecting(false)
    }
  }, [projectId, connectInput, initConnect, startAwaitingWebhook])

  const handleRetryConnect = useCallback(
    async (domainId: string) => {
      setRetrying(true)
      try {
        const result = await retryConnect.mutateAsync({ projectId, domainId })

        // SSL-only retry: backend just reset status, no Entri modal needed
        if ('sslRetryOnly' in result && result.sslRetryOnly) {
          toast.success('Retrying SSL provisioning...')
          return
        }

        // Full retry: re-open Entri Connect modal for DNS setup
        try {
          await showEntri({
            applicationId: result.applicationId,
            token: result.token,
            prefilledDomain: result.prefilledDomain,
            dnsRecords: result.dnsRecords,
            userId: result.userId,
            power: true,
          })
        } catch (entriErr) {
          console.error('Entri Connect retry error:', entriErr)
        }
      } finally {
        setRetrying(false)
      }
    },
    [projectId, retryConnect],
  )

  // ─── Loading ────────────────────────────────────────────────────
  if (domainsLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-5 py-4 space-y-3 min-w-0 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
        <Globe className="size-3.5 text-brand" weight="bold" />
        Custom Domain
      </div>

      {/* Awaiting webhook */}
      {awaitingWebhook && !currentDomain && (
        <DomainStatusCard domainName="Setting up..." status="awaiting" />
      )}

      {/* Current domain status */}
      {currentDomain && (
        <DomainStatusCard
          domainName={currentDomain.domainName}
          status={currentDomain.status as keyof typeof statusConfig}
          isStale={configuringDomain ? isConfigStale : undefined}
          lastError={currentDomain.lastError}
          logs={currentDomain.logs}
          onVisit={
            activeDomain ? `https://${activeDomain.domainName.replace(/^www\./, '')}` : undefined
          }
          onRetry={
            configuringDomain
              ? () => handleRetryConnect(configuringDomain.id)
              : errorDomain
                ? () => handleRetryConnect(errorDomain.id)
                : undefined
          }
          onRemove={() => removeDomain.mutate({ projectId, domainId: currentDomain.id })}
          retrying={retrying || retryConnect.isPending}
          removing={removeDomain.isPending}
        />
      )}

      {/* No domain — Buy / Connect */}
      {!currentDomain && !awaitingWebhook && (
        <div className="space-y-3">
          {/* Mode tabs */}
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode('connect')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                mode === 'connect'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connect domain
            </button>
            <button
              type="button"
              onClick={() => setMode('buy')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                mode === 'buy'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Buy new
            </button>
          </div>

          {mode === 'connect' ? (
            /* ── Connect existing domain ── */
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={connectInput}
                  onChange={(e) => setConnectInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  placeholder="myapp.com"
                  className="flex-1 min-w-0 h-9 px-3 rounded-md border bg-background text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-shadow"
                />
                <Button
                  className="h-9 shrink-0"
                  onClick={handleConnect}
                  disabled={connecting || initConnect.isPending || !connectInput.trim()}
                >
                  {connecting || initConnect.isPending ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Link className="size-3.5 mr-1.5" weight="bold" />
                  )}
                  Connect
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/50 px-0.5">
                We'll configure DNS automatically for most providers.
              </p>
            </div>
          ) : (
            /* ── Buy domain ── */
            <div className="space-y-2">
              <Button
                className="w-full h-9"
                onClick={() => handleBuyDomain(false)}
                disabled={launching || initPurchase.isPending}
              >
                {launching || initPurchase.isPending ? (
                  <Loader2 className="size-3.5 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="size-3.5 mr-2" weight="bold" />
                )}
                Search & buy a domain
              </Button>
              <button
                type="button"
                onClick={() => handleBuyDomain(true)}
                disabled={launching || initPurchase.isPending}
                className="w-full h-8 rounded-md border border-dashed border-brand/30 bg-brand/5 text-xs font-medium text-brand hover:bg-brand/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Sparkle className="size-3.5" weight="fill" />
                Get a free domain
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
