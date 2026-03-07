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
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { showEntri, purchaseDomain, type EntriConfig } from 'entrijs'
import {
  useInitDomainPurchase,
  useInitDomainConnect,
  useRetryDomainConnect,
  useProjectDomains,
  useOnDomainPurchased,
  useRemoveDomain,
  type DomainLogEntry,
} from '@/queries/domains'

// ─── Status badge config ─────────────────────────────────────────
const statusConfig = {
  active: { label: 'Live', color: 'emerald', bg: 'bg-emerald-500/6 border-emerald-500/20' },
  dns_configuring: {
    label: 'Configuring DNS',
    color: 'amber',
    bg: 'bg-amber-500/6 border-amber-500/20',
  },
  purchasing: { label: 'Purchasing', color: 'amber', bg: 'bg-amber-500/6 border-amber-500/20' },
  pending: { label: 'Pending', color: 'amber', bg: 'bg-amber-500/6 border-amber-500/20' },
  error: { label: 'Failed', color: 'red', bg: 'bg-red-500/6 border-red-500/20' },
  awaiting: { label: 'Setting up', color: 'brand', bg: 'bg-brand/5 border-brand/20' },
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

// ─── Activity log ────────────────────────────────────────────────
function DomainLogs({ logs }: { logs?: DomainLogEntry[] }) {
  if (!logs?.length) return null

  return (
    <details className="group">
      <summary className="text-[11px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground select-none">
        Activity ({logs.length})
      </summary>
      <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
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

// ─── Domain status card (unified for all states) ─────────────────
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
  const showSpinner = isPending || (status === 'dns_configuring' && !isStale)

  return (
    <div className="space-y-2.5">
      <div
        className={`flex items-center gap-2.5 h-10 px-3 rounded-lg border ${cfg.bg} font-mono text-sm`}
      >
        {showSpinner ? (
          <Loader2 className={`size-3.5 animate-spin ${textColor[cfg.color]} shrink-0`} />
        ) : isStale ? (
          <Warning className="size-3.5 text-amber-500 shrink-0" weight="fill" />
        ) : (
          <span
            className={`size-2 rounded-full shrink-0 ${dotColor[cfg.color]} ${isActive ? '' : 'animate-pulse'}`}
          />
        )}
        <span className="flex-1 truncate">
          {domainName === 'pending' ? 'Processing...' : domainName}
        </span>
        <span className={`text-[11px] font-medium ${textColor[cfg.color]}`}>
          {isStale ? 'Stuck' : cfg.label}
        </span>
        {onVisit && (
          <a
            href={onVisit}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <ArrowSquareOut className="size-3.5 text-muted-foreground" />
          </a>
        )}
        {onRemove && !onRetry && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash className="size-3.5" />
          </button>
        )}
      </div>

      {lastError && (
        <p className="text-[11px] text-red-500/80 bg-red-500/5 px-2.5 py-1.5 rounded-md">
          {lastError}
        </p>
      )}

      {isStale && !lastError && (
        <p className="text-[11px] text-amber-600/80">
          DNS not configured yet. Retry to re-open the setup wizard.
        </p>
      )}

      <DomainLogs logs={logs} />

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
              {isError ? 'Retry' : 'Retry DNS'}
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

// ─── Main panel ──────────────────────────────────────────────────
interface DomainSearchPanelProps {
  projectId: string
}

export function DomainSearchPanel({ projectId }: DomainSearchPanelProps) {
  const [mode, setMode] = useState<'buy' | 'connect'>('buy')
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
  const configuringDomain = domainsData?.domains?.find((d) => d.status === 'dns_configuring')
  const pendingDomain = domainsData?.domains?.find((d) =>
    ['pending', 'purchasing'].includes(d.status),
  )
  const errorDomain = domainsData?.domains?.find((d) => d.status === 'error')
  const currentDomain = activeDomain || configuringDomain || errorDomain || pendingDomain

  const isConfigStale = useMemo(() => {
    if (!configuringDomain) return false
    return Date.now() - new Date(configuringDomain.createdAt).getTime() > 5 * 60 * 1000
  }, [configuringDomain])

  useEffect(() => {
    if (awaitingWebhook && (activeDomain || configuringDomain || pendingDomain)) {
      setAwaitingWebhook(false)
      clearTimeout(awaitingTimerRef.current)
    }
  }, [awaitingWebhook, activeDomain, configuringDomain, pendingDomain])

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

  const handleBuyDomain = useCallback(async () => {
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
      }
      await purchaseDomain(sellConfig)
      startAwaitingWebhook()
    } finally {
      setLaunching(false)
    }
  }, [projectId, initPurchase, startAwaitingWebhook, onPurchased])

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
        const config = await retryConnect.mutateAsync({ projectId, domainId })
        try {
          await showEntri({
            applicationId: config.applicationId,
            token: config.token,
            prefilledDomain: config.prefilledDomain,
            dnsRecords: config.dnsRecords,
            userId: config.userId,
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

  // ─── Loading ───────────────────────────────────────────────────
  if (domainsLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading
      </div>
    )
  }

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
        <Globe className="size-3.5 text-brand" weight="bold" />
        Custom Domain
      </div>

      {/* Awaiting webhook */}
      {awaitingWebhook && !currentDomain && (
        <DomainStatusCard domainName="Setting up..." status="awaiting" />
      )}

      {/* Active / configuring / error / pending domain */}
      {currentDomain && (
        <DomainStatusCard
          domainName={currentDomain.domainName}
          status={currentDomain.status as keyof typeof statusConfig}
          isStale={configuringDomain ? isConfigStale : undefined}
          lastError={currentDomain.lastError}
          logs={currentDomain.logs}
          onVisit={activeDomain ? `https://${activeDomain.domainName}` : undefined}
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
        <>
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode('buy')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                mode === 'buy'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Buy new
            </button>
            <button
              type="button"
              onClick={() => setMode('connect')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                mode === 'connect'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              I have one
            </button>
          </div>

          {mode === 'buy' ? (
            <Button
              className="w-full h-9"
              onClick={handleBuyDomain}
              disabled={launching || initPurchase.isPending}
            >
              {launching || initPurchase.isPending ? (
                <Loader2 className="size-3.5 animate-spin mr-2" />
              ) : (
                <ShoppingCart className="size-3.5 mr-2" weight="bold" />
              )}
              Search & buy a domain
            </Button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={connectInput}
                onChange={(e) => setConnectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="myapp.com"
                className="flex-1 h-9 px-3 rounded-md border bg-background text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
              <Button
                className="h-9"
                onClick={handleConnect}
                disabled={connecting || initConnect.isPending || !connectInput.trim()}
              >
                {connecting || initConnect.isPending ? (
                  <Loader2 className="size-3.5 animate-spin mr-2" />
                ) : (
                  <Link className="size-3.5 mr-2" weight="bold" />
                )}
                Connect
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
