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
import { CheckCircle, XCircle, Clock } from '@phosphor-icons/react'

function DomainLogs({ logs }: { logs?: DomainLogEntry[] }) {
  if (!logs || logs.length === 0) return null

  return (
    <details className="group">
      <summary className="text-[11px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground select-none">
        Activity log ({logs.length})
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

  // Detect if dns_configuring is stale (>5 min)
  const isConfigStale = useMemo(() => {
    if (!configuringDomain) return false
    const created = new Date(configuringDomain.createdAt).getTime()
    return Date.now() - created > 5 * 60 * 1000
  }, [configuringDomain])

  // Stop fast-polling once a domain record appears
  useEffect(() => {
    if (awaitingWebhook && (activeDomain || configuringDomain || pendingDomain)) {
      setAwaitingWebhook(false)
      clearTimeout(awaitingTimerRef.current)
    }
  }, [awaitingWebhook, activeDomain, configuringDomain, pendingDomain])

  // Start fast-polling for webhook to create domain record, auto-stop after 30s
  const startAwaitingWebhook = useCallback(() => {
    clearTimeout(awaitingTimerRef.current)
    setAwaitingWebhook(true)
    awaitingTimerRef.current = setTimeout(() => setAwaitingWebhook(false), 30_000)
  }, [])

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(awaitingTimerRef.current), [])

  // Listen for Entri modal close events (covers both Sell and Connect flows)
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

  // Launch Entri Sell modal
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
        whiteLabel: {
          sell: { contact: config.contact },
        },
      }
      await purchaseDomain(sellConfig)

      startAwaitingWebhook()
    } finally {
      setLaunching(false)
    }
  }, [projectId, initPurchase, startAwaitingWebhook, onPurchased])

  // Launch Entri Connect modal for an existing domain
  const handleConnect = useCallback(async () => {
    if (!connectInput.trim()) return
    setConnecting(true)
    try {
      const config = await initConnect.mutateAsync({
        projectId,
        domain: connectInput.trim(),
      })

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

  // Retry Entri Connect for stuck/error domain
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

  // ─── Active domain (live) ─────────────────────────────────────
  if (activeDomain) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Globe className="size-3.5" weight="bold" />
          Custom Domain
        </div>
        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 font-mono text-sm">
          <span className="size-2 rounded-full shrink-0 bg-emerald-500" />
          <span className="flex-1 truncate">{activeDomain.domainName}</span>
          <span className="text-[11px] text-emerald-600/80">Live</span>
          <a
            href={`https://${activeDomain.domainName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <ArrowSquareOut className="size-3.5 text-muted-foreground" />
          </a>
          <button
            type="button"
            onClick={() => removeDomain.mutate({ projectId, domainId: activeDomain.id })}
            disabled={removeDomain.isPending}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash className="size-3.5" />
          </button>
        </div>
        <DomainLogs logs={activeDomain.logs} />
      </div>
    )
  }

  // ─── Loading ──────────────────────────────────────────────────
  if (domainsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading
      </div>
    )
  }

  // ─── Awaiting webhook (Sell flow — DB record not created yet) ─
  if (awaitingWebhook && !activeDomain && !configuringDomain && !pendingDomain) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Globe className="size-3.5" weight="bold" />
          Custom Domain
        </div>
        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-indigo-500/5 border-indigo-500/20 font-mono text-sm">
          <Loader2 className="size-3.5 animate-spin text-indigo-500" />
          <span className="flex-1 text-muted-foreground text-xs">Setting up your domain...</span>
        </div>
      </div>
    )
  }

  // ─── DNS Configuring — show domain with retry + remove ────────
  if (configuringDomain) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Globe className="size-3.5" weight="bold" />
          Custom Domain
        </div>
        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-amber-500/5 border-amber-500/20 font-mono text-sm">
          {isConfigStale ? (
            <Warning className="size-3.5 text-amber-500 shrink-0" weight="fill" />
          ) : (
            <span className="size-2 rounded-full shrink-0 bg-amber-500 animate-pulse" />
          )}
          <span className="flex-1 truncate">{configuringDomain.domainName}</span>
          <span className="text-[11px] text-muted-foreground/60">
            {isConfigStale ? 'DNS not configured' : 'Configuring DNS...'}
          </span>
        </div>
        {isConfigStale && (
          <p className="text-[11px] text-amber-600/80">
            DNS configuration seems stuck. Retry to re-open the setup wizard, or remove and start
            over.
          </p>
        )}
        {configuringDomain.lastError && (
          <p className="text-[11px] text-red-500/80 bg-red-500/5 px-2 py-1 rounded">
            {configuringDomain.lastError}
          </p>
        )}
        <DomainLogs logs={configuringDomain.logs} />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={() => handleRetryConnect(configuringDomain.id)}
            disabled={retrying || retryConnect.isPending}
          >
            {retrying || retryConnect.isPending ? (
              <Loader2 className="size-3 animate-spin mr-1.5" />
            ) : (
              <ArrowClockwise className="size-3 mr-1.5" weight="bold" />
            )}
            Retry DNS setup
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => removeDomain.mutate({ projectId, domainId: configuringDomain.id })}
            disabled={removeDomain.isPending}
          >
            <Trash className="size-3 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    )
  }

  // ─── Error state — retry or remove ────────────────────────────
  if (errorDomain) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Globe className="size-3.5" weight="bold" />
          Custom Domain
        </div>
        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-red-500/5 border-red-500/20 font-mono text-sm">
          <Warning className="size-3.5 text-red-500 shrink-0" weight="fill" />
          <span className="flex-1 truncate">{errorDomain.domainName}</span>
          <span className="text-[11px] text-red-500/80">Failed</span>
        </div>
        <p className="text-[11px] text-red-500/80">
          {errorDomain.lastError ||
            'Domain setup failed. Retry to try again, or remove and start fresh.'}
        </p>
        <DomainLogs logs={errorDomain.logs} />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={() => handleRetryConnect(errorDomain.id)}
            disabled={retrying || retryConnect.isPending}
          >
            {retrying || retryConnect.isPending ? (
              <Loader2 className="size-3 animate-spin mr-1.5" />
            ) : (
              <ArrowClockwise className="size-3 mr-1.5" weight="bold" />
            )}
            Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => removeDomain.mutate({ projectId, domainId: errorDomain.id })}
            disabled={removeDomain.isPending}
          >
            <Trash className="size-3 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    )
  }

  // ─── Pending purchase ─────────────────────────────────────────
  if (pendingDomain) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Globe className="size-3.5" weight="bold" />
          Custom Domain
        </div>
        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-amber-500/5 border-amber-500/20 font-mono text-sm">
          <Loader2 className="size-3.5 animate-spin text-amber-500" />
          <span className="flex-1 truncate text-muted-foreground">
            {pendingDomain.domainName === 'pending'
              ? 'Waiting for purchase...'
              : pendingDomain.domainName}
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            {pendingDomain.status === 'purchasing' ? 'Purchasing...' : 'Pending'}
          </span>
          <button
            type="button"
            onClick={() => removeDomain.mutate({ projectId, domainId: pendingDomain.id })}
            disabled={removeDomain.isPending}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <Trash className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // ─── No domain — show Buy / Connect options ─────────────────
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
        <Globe className="size-3.5" weight="bold" />
        Add a Custom Domain
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-lg border bg-muted/50 p-0.5">
        <button
          type="button"
          onClick={() => setMode('buy')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            mode === 'buy'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Buy a domain
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
          Connect existing
        </button>
      </div>

      {mode === 'buy' ? (
        <>
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
          <p className="text-[11px] text-muted-foreground/60">
            Find and purchase a new domain. DNS will be configured automatically.
          </p>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={connectInput}
              onChange={(e) => setConnectInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              placeholder="e.g. myapp.com"
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
          <p className="text-[11px] text-muted-foreground/60">
            Enter a domain you already own. You&apos;ll be guided to configure DNS records.
          </p>
        </>
      )}
    </div>
  )
}
