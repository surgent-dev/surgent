'use client'

import { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Globe, MagnifyingGlass, Check, X, ArrowSquareOut, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  useCheckDomainAvailability,
  useInitDomainPurchase,
  useMockDomainPurchase,
  useProjectDomains,
  useOnDomainPurchased,
  useRemoveDomain,
} from '@/queries/domains'

declare global {
  interface Window {
    entri?: {
      showEntri(config: Record<string, unknown>): void
    }
  }
}

interface DomainSearchPanelProps {
  projectId: string
}

export function DomainSearchPanel({ projectId }: DomainSearchPanelProps) {
  const [searchInput, setSearchInput] = useState('')

  const { data: domainsData, isLoading: domainsLoading } = useProjectDomains(projectId)
  const checkAvailability = useCheckDomainAvailability()
  const initPurchase = useInitDomainPurchase()
  const mockPurchase = useMockDomainPurchase()
  const removeDomain = useRemoveDomain()
  const onPurchased = useOnDomainPurchased()

  const activeDomain = domainsData?.domains?.find((d) =>
    ['active', 'dns_configuring'].includes(d.status),
  )
  const pendingDomain = domainsData?.domains?.find((d) =>
    ['pending', 'purchasing'].includes(d.status),
  )

  const handleSearch = useCallback(() => {
    if (!searchInput.trim()) return
    const domain = searchInput.includes('.') ? searchInput.trim() : `${searchInput.trim()}.com`
    checkAvailability.mutate(domain)
  }, [searchInput, checkAvailability])

  const handlePurchase = useCallback(async () => {
    if (!checkAvailability.data?.domain) return

    const config = await initPurchase.mutateAsync({
      projectId,
      suggestedDomain: checkAvailability.data.domain,
    })

    // Dev mode: skip Entri modal and instantly activate via mock endpoint
    if (config.devMode) {
      await mockPurchase.mutateAsync({
        domainId: config.domainId,
        domainName: checkAvailability.data.domain,
      })
      return
    }

    if (!window.entri) {
      window.open(
        `https://app.goentri.com/sell?domain=${encodeURIComponent(config.prefilledDomain || '')}`,
        '_blank',
      )
      return
    }

    window.entri.showEntri({
      applicationId: config.applicationId,
      token: config.token,
      prefilledDomain: config.prefilledDomain,
      dnsRecords: config.dnsRecords,
      userId: config.contact.email,
      contact: config.contact,
      whiteLabel: {
        hideEntriLogo: true,
        customCta: 'Get this domain',
        theme: { primaryColor: '#6366f1' },
      },
      onSuccess: (data: { domain?: string }) => {
        onPurchased(projectId, data.domain || config.prefilledDomain || '')
      },
      onError: (err: unknown) => {
        console.error('Entri purchase error:', err)
      },
    })
  }, [checkAvailability.data, projectId, initPurchase, mockPurchase, onPurchased])

  // Existing active domain
  if (activeDomain) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Globe className="size-3.5" weight="bold" />
          Custom Domain
        </div>
        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border bg-muted/20 font-mono text-sm">
          <span
            className={`size-2 rounded-full shrink-0 ${
              activeDomain.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className="flex-1 truncate">{activeDomain.domainName}</span>
          <span className="text-[11px] text-muted-foreground/60">
            {activeDomain.status === 'active' ? 'Live' : 'Configuring DNS...'}
          </span>
          {activeDomain.status === 'active' && (
            <a
              href={`https://${activeDomain.domainName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ArrowSquareOut className="size-3.5 text-muted-foreground" />
            </a>
          )}
          <button
            type="button"
            onClick={() => removeDomain.mutate({ projectId, domainId: activeDomain.id })}
            disabled={removeDomain.isPending}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (domainsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading
      </div>
    )
  }

  // Pending purchase in progress
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
        </div>
      </div>
    )
  }

  // Search & purchase flow
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
        <Globe className="size-3.5" weight="bold" />
        Add a Custom Domain
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="e.g. myapp.com"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full h-9 px-3 rounded-md border bg-transparent text-sm font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-3"
          onClick={handleSearch}
          disabled={!searchInput.trim() || checkAvailability.isPending}
        >
          {checkAvailability.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MagnifyingGlass className="size-3.5" weight="bold" />
          )}
        </Button>
      </div>

      {/* Result */}
      {checkAvailability.data && (
        <div
          className={`flex items-center justify-between h-10 px-3 rounded-lg border text-sm ${
            checkAvailability.data.available
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-destructive/30 bg-destructive/5'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {checkAvailability.data.available ? (
              <Check className="size-4 text-emerald-500 shrink-0" weight="bold" />
            ) : (
              <X className="size-4 text-destructive shrink-0" weight="bold" />
            )}
            <span className="font-mono truncate">{checkAvailability.data.domain}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {checkAvailability.data.available ? 'Available' : 'Unavailable'}
            </span>
          </div>

          {checkAvailability.data.available && (
            <Button
              size="sm"
              className="h-7 text-xs ml-2 shrink-0"
              onClick={handlePurchase}
              disabled={initPurchase.isPending || mockPurchase.isPending}
            >
              {initPurchase.isPending || mockPurchase.isPending ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : null}
              Purchase
            </Button>
          )}
        </div>
      )}

      {/* Hint */}
      {!checkAvailability.data && (
        <p className="text-[11px] text-muted-foreground/60">
          Search for a domain to purchase and connect to your project.
        </p>
      )}
    </div>
  )
}
