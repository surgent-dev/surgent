'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Globe,
  ArrowSquareOut,
  ShoppingCart,
  ArrowClockwise,
  Link,
  CheckCircle,
  Copy,
  Gift,
  XCircle,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { showEntri, purchaseDomain, type EntriConfig } from 'entrijs'
import { toast } from 'react-hot-toast'
import {
  useInitDomainPurchase,
  useInitDomainConnect,
  useBindEntriFlow,
  useRetryDomainConnect,
  useProjectDomains,
  useOnDomainPurchased,
  useRemoveDomain,
  useDomainConfig,
} from '@/queries/domains'

// ─── Helpers ────────────────────────────────────────────────────

type DomainStatus =
  | 'pending'
  | 'purchasing'
  | 'dns_configuring'
  | 'ssl_provisioning'
  | 'active'
  | 'error'

const STATUS_HINT: Partial<Record<DomainStatus, string>> = {
  dns_configuring: 'Waiting for DNS to propagate — this can take up to 24 hours',
  ssl_provisioning: 'Setting up HTTPS certificate — this can take up to 24 hours',
  purchasing: 'Processing purchase',
  pending: 'Waiting for confirmation',
}

function isInProgress(s: DomainStatus) {
  return s !== 'active' && s !== 'error'
}

const DOMAIN_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/

// ─── Domain card ────────────────────────────────────────────────

function DomainCard({
  domainName,
  status,
  lastError,
  onRetry,
  onRemove,
  retrying,
  removing,
}: {
  domainName: string
  status: DomainStatus
  lastError?: string | null
  onRetry?: () => void
  onRemove: () => void
  retrying?: boolean
  removing?: boolean
}) {
  const isActive = status === 'active'
  const isError = status === 'error'
  const inProgress = isInProgress(status)
  const url = `https://${domainName.replace(/^www\./, '')}`

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status indicator */}
        {isActive ? (
          <CheckCircle className="size-4 text-emerald-500 shrink-0" weight="fill" />
        ) : isError ? (
          <XCircle className="size-4 text-red-500 shrink-0" weight="fill" />
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground/60 shrink-0" />
        )}

        {/* Domain name */}
        <div className="flex-1 min-w-0">
          {isActive ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-mono text-[13px] hover:underline underline-offset-2"
            >
              {domainName}
            </a>
          ) : (
            <span className="block truncate font-mono text-[13px] text-muted-foreground">
              {domainName}
            </span>
          )}
          {inProgress && STATUS_HINT[status] && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{STATUS_HINT[status]}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center shrink-0">
          {isActive && (
            <>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(url)
                  toast.success('Copied')
                }}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <Copy className="size-3.5 text-muted-foreground" />
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <ArrowSquareOut className="size-3.5 text-muted-foreground" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {isError && lastError && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-[11px] text-red-500/80 leading-relaxed">{lastError}</p>
        </div>
      )}

      {/* Footer actions */}
      {(isError || inProgress) && (
        <div className="flex items-center border-t px-4 py-2 bg-muted/20">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="text-[12px] font-medium text-foreground/80 hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-1.5 mr-auto"
            >
              {retrying ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ArrowClockwise className="size-3" weight="bold" />
              )}
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="text-[12px] text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50 ml-auto"
          >
            {removing ? 'Removing...' : 'Remove'}
          </button>
        </div>
      )}

      {/* Active footer */}
      {isActive && (
        <div className="border-t bg-muted/20">
          <div className="flex items-center px-4 py-2">
            <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 mr-auto">
              Live
            </span>
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className="text-[12px] text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {removing ? 'Removing...' : 'Disconnect'}
            </button>
          </div>
          <p className="px-4 pb-2 text-[11px] text-muted-foreground/60 leading-relaxed">
            DNS and SSL may take up to 24 hours to fully propagate
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main panel ─────────────────────────────────────────────────

interface DomainSearchPanelProps {
  projectId: string
  hasDeployment?: boolean
  onDeploy?: () => void
}

export function DomainSearchPanel({
  projectId,
  hasDeployment = true,
  onDeploy,
}: DomainSearchPanelProps) {
  const [mode, setMode] = useState<'buy' | 'connect'>('connect')
  const [launching, setLaunching] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectInput, setConnectInput] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [awaitingWebhook, setAwaitingWebhook] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    { type: 'buy'; free?: boolean } | { type: 'connect' } | null
  >(null)
  const awaitingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingEntriRef = useRef<{ domainId?: string; freeDomain?: boolean } | null>(null)

  const isValidDomain = useMemo(() => DOMAIN_RE.test(connectInput.trim()), [connectInput])

  const { data: domainsData, isLoading } = useProjectDomains(projectId, awaitingWebhook)
  const initPurchase = useInitDomainPurchase()
  const initConnect = useInitDomainConnect()
  const retryConnect = useRetryDomainConnect()
  const bindEntriFlow = useBindEntriFlow()
  const removeDomain = useRemoveDomain()
  const onPurchased = useOnDomainPurchased()
  const { data: domainConfig } = useDomainConfig()

  const domains = domainsData?.domains ?? []
  const activeDomain = domains.find((d) => d.status === 'active')
  const pendingDomain = domains.find((d) => isInProgress(d.status as DomainStatus))
  const errorDomain = domains.find((d) => d.status === 'error')
  const currentDomain = activeDomain || pendingDomain || errorDomain
  const showConnectForm = !awaitingWebhook && !pendingAction && !pendingDomain

  useEffect(() => {
    if (awaitingWebhook && currentDomain) {
      setAwaitingWebhook(false)
      clearTimeout(awaitingTimerRef.current)
    }
  }, [awaitingWebhook, currentDomain])

  const startAwaitingWebhook = useCallback(() => {
    clearTimeout(awaitingTimerRef.current)
    setAwaitingWebhook(true)
    awaitingTimerRef.current = setTimeout(() => setAwaitingWebhook(false), 30_000)
  }, [])

  useEffect(() => () => clearTimeout(awaitingTimerRef.current), [])

  useEffect(() => {
    if (!hasDeployment || !pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    if (action.type === 'buy') handleBuyDomain(action.free)
    else handleConnect()
  }, [hasDeployment, pendingAction]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const domain =
        typeof detail?.domain === 'string' ? detail.domain.replace(/^www\./i, '') : null
      const entriFlowId = detail?.jobId || detail?.job_id || null
      if (!domain) return

      const pending = pendingEntriRef.current
      pendingEntriRef.current = null
      onPurchased(projectId, domain)
      startAwaitingWebhook()

      if (entriFlowId) {
        bindEntriFlow.mutate({
          projectId,
          domain,
          entriFlowId,
          ...(pending?.domainId ? { domainId: pending.domainId } : {}),
          ...(pending?.freeDomain ? { freeDomain: true } : {}),
        })
      }
    }
    window.addEventListener('onEntriSuccess', handler)
    return () => window.removeEventListener('onEntriSuccess', handler)
  }, [bindEntriFlow, projectId, onPurchased, startAwaitingWebhook])

  const handleBuyDomain = useCallback(
    async (free?: boolean) => {
      if (!hasDeployment) {
        setPendingAction({ type: 'buy', free })
        onDeploy?.()
        return
      }
      setLaunching(true)
      try {
        const config = await initPurchase.mutateAsync({
          projectId,
          ...(free ? { freeDomain: true } : {}),
        })
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
        pendingEntriRef.current = { freeDomain: Boolean(free) }
        await purchaseDomain(sellConfig)
      } finally {
        setLaunching(false)
      }
    },
    [projectId, hasDeployment, onDeploy, initPurchase],
  )

  const handleConnect = useCallback(async () => {
    if (!connectInput.trim()) return
    if (!hasDeployment) {
      setPendingAction({ type: 'connect' })
      onDeploy?.()
      return
    }
    setConnecting(true)
    try {
      const config = await initConnect.mutateAsync({ projectId, domain: connectInput.trim() })
      pendingEntriRef.current = { domainId: config.domainId }
      try {
        await showEntri({
          applicationId: config.applicationId,
          token: config.token,
          prefilledDomain: config.prefilledDomain,
          dnsRecords: config.dnsRecords,
          userId: config.userId,
          power: true,
        })
      } catch {
        // User closed Entri modal
      }
      setConnectInput('')
    } finally {
      setConnecting(false)
    }
  }, [projectId, connectInput, hasDeployment, onDeploy, initConnect])

  const handleRetry = useCallback(
    async (domainId: string) => {
      setRetrying(true)
      try {
        const result = await retryConnect.mutateAsync({ projectId, domainId })
        pendingEntriRef.current = { domainId }
        try {
          await showEntri({
            applicationId: result.applicationId,
            token: result.token,
            prefilledDomain: result.prefilledDomain,
            dnsRecords: result.dnsRecords,
            userId: result.userId,
            power: true,
          })
        } catch {
          // User closed Entri modal
        }
      } finally {
        setRetrying(false)
      }
    },
    [projectId, retryConnect],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 uppercase tracking-widest font-semibold">
        <Globe className="size-3.5" weight="bold" />
        Custom Domain
      </div>

      {/* Awaiting webhook */}
      {awaitingWebhook && !currentDomain && (
        <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground/60" />
          <span className="text-[13px] text-muted-foreground">Setting up your domain...</span>
        </div>
      )}

      {/* Domain card — active, pending, or error */}
      {currentDomain && (
        <DomainCard
          domainName={currentDomain.domainName}
          status={currentDomain.status as DomainStatus}
          lastError={currentDomain.lastError}
          onRetry={
            ['dns_configuring', 'ssl_provisioning', 'error'].includes(currentDomain.status)
              ? () => handleRetry(currentDomain.id)
              : undefined
          }
          onRemove={() => removeDomain.mutate({ projectId, domainId: currentDomain.id })}
          retrying={retrying}
          removing={removeDomain.isPending}
        />
      )}

      {/* Deploy-first message */}
      {pendingAction && !hasDeployment && (
        <div className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-brand shrink-0" />
          <p className="text-[13px] text-muted-foreground">Deploying your app first...</p>
        </div>
      )}

      {/* Connect / Buy form */}
      {showConnectForm && (
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            {(['connect', 'buy'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-all ${
                  mode === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'connect' ? 'Connect domain' : 'Buy new'}
              </button>
            ))}
          </div>

          {mode === 'connect' ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={connectInput}
                  onChange={(e) => setConnectInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && isValidDomain && handleConnect()}
                  placeholder="myapp.com"
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg border bg-background text-[13px] font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-shadow"
                />
                <Button
                  size="sm"
                  className="h-9 px-4 shrink-0"
                  onClick={handleConnect}
                  disabled={connecting || initConnect.isPending || !isValidDomain}
                >
                  {connecting || initConnect.isPending ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Link className="size-3.5 mr-1.5" weight="bold" />
                  )}
                  Connect
                </Button>
              </div>
              {connectInput.trim() && !isValidDomain && (
                <p className="text-[11px] text-amber-500">Enter a valid domain (e.g. myapp.com)</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                variant="outline"
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
              {domainConfig?.freeDomainEnabled && (
                <button
                  type="button"
                  onClick={() => handleBuyDomain(true)}
                  disabled={launching || initPurchase.isPending}
                  className="w-full h-8 rounded-lg border border-dashed border-brand/30 bg-brand/5 text-[12px] font-medium text-brand hover:bg-brand/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Gift className="size-3.5" weight="fill" />
                  Claim free domain
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
