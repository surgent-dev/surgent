'use client'

import {
  WebPreview,
  WebPreviewNavButtons,
  WebPreviewUrl,
  WebPreviewBody,
} from '@/components/agent/web-preview'
import { useEffect, useState, type ElementType } from 'react'
import {
  X,
  Database,
  Monitor,
  GitCompare,
  ScrollText,
  Terminal,
  Plus,
  Power,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import { Coins } from '@phosphor-icons/react'
import Image from 'next/image'
import type { FileDiff } from '@opencode-ai/sdk'

import {
  useConvexDashboardQuery,
  useActivateProject,
  useSandboxHealthQuery,
  useSandboxLogsQuery,
  type ConvexDashboardCredentials,
} from '@/queries/projects'

import {
  useSurpayAccounts,
  useSurpayDisconnect,
  useWhopConnect,
  type SurpayAccount,
} from '@/queries/surpay'
import { usePayEnv } from '@/stores/pay-env'
import { useSessionDiff } from '@/queries/chats'
import { useSandbox } from '@/hooks/use-sandbox'

import DiffView from '@/components/diff/diff-view'
import { ProductsSection } from '@/components/payments/products-section'
import { parseConnectError } from '@/components/payments/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { EmbeddedDashboard } from '@/components/agent/convex-dashboard'
import { FunLoadingState } from '@/components/ui/fun-loading'
import { PreviewErrorOverlay } from '@/components/agent/preview-error-overlay'

export interface PreviewTab {
  id: string
  type: 'preview' | 'changes' | 'convex' | 'logs' | 'payments'
  title: string
  diffs?: FileDiff[]
  messageId?: string
  sessionId?: string
  convexPath?: string
  convexEnv?: 'development' | 'production'
}

const DEFAULT_TABS: PreviewTab[] = [{ id: 'preview', type: 'preview', title: 'Preview' }]

function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: ElementType
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center px-4">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="size-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="font-medium text-sm sm:text-base">{title}</p>
      <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

const formatStatus = (status: string) => status.replace(/[_-]/g, ' ')

const getStatusTone = (status: string) => {
  const value = status.toLowerCase()
  if (['ready', 'running', 'connected', 'online', 'ok', 'healthy'].includes(value))
    return 'text-success'
  if (['warning', 'degraded'].includes(value)) return 'text-warning'
  if (['error', 'failed', 'offline', 'disconnected', 'down'].includes(value))
    return 'text-destructive'
  return 'text-muted-foreground'
}

const getStatusDot = (status: string) => {
  const value = status.toLowerCase()
  if (['ready', 'running', 'connected', 'online', 'ok', 'healthy'].includes(value))
    return 'bg-success'
  if (['warning', 'degraded'].includes(value)) return 'bg-warning'
  if (['error', 'failed', 'offline', 'disconnected', 'down'].includes(value))
    return 'bg-destructive'
  return 'bg-muted-foreground/40'
}

// Wrapper for backwards compatibility (ignores old props, uses fun loading)
function LoadingState(_props: { icon?: typeof Database; message?: string }) {
  return <FunLoadingState />
}

// Navigation controls for the tab bar (only shown when preview is active)
function PreviewNavControls() {
  return (
    <div className="flex min-w-0 items-center gap-2 px-2">
      <WebPreviewNavButtons />
      <WebPreviewUrl className="min-w-0" />
    </div>
  )
}

function ConvexContent({
  credentials,
  isLoading,
  path,
}: {
  credentials?: ConvexDashboardCredentials
  isLoading: boolean
  path?: string
}) {
  if (isLoading) {
    return <LoadingState icon={Database} message="Loading Convex dashboard..." />
  }

  if (!credentials) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">
          Convex not configured for this project
        </span>
      </div>
    )
  }

  return <EmbeddedDashboard credentials={credentials} path={path || 'data'} />
}

function ChangesContent({ diffs }: { diffs: FileDiff[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {diffs.map((d, i) => (
          <DiffView
            key={i}
            before={d.before}
            after={d.after}
            path={d.file}
            collapseUnchanged
            contextLines={3}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function LogSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <Terminal className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{title}</span>
      </div>
      <pre className="rounded-lg border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap wrap-break-word text-foreground/80 max-h-64 overflow-y-auto">
        {content.trim() || 'No output'}
      </pre>
    </div>
  )
}

function LogsContent({
  app,
  opencode,
  isLoading,
}: {
  app?: string
  opencode?: string
  isLoading: boolean
}) {
  if (isLoading) return <LoadingState icon={ScrollText} message="Loading logs..." />
  if (!app && !opencode)
    return (
      <EmptyState
        title="No logs yet"
        description="Logs will appear when processes are running"
        icon={ScrollText}
      />
    )

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {app && <LogSection title="App Server" content={app} />}
        {opencode && <LogSection title="AI Server" content={opencode} />}
      </div>
    </ScrollArea>
  )
}

function ConnectPaymentsView({ disconnectedAccount }: { disconnectedAccount?: SurpayAccount }) {
  const [companyName, setCompanyName] = useState('')
  const whopConnect = useWhopConnect()
  const env = usePayEnv((s) => s.env)
  const isLive = env === 'live'

  const handleReconnect = async () => {
    if (!disconnectedAccount) return
    try {
      await whopConnect.mutateAsync({
        accountId: disconnectedAccount.id,
        data: {
          email: disconnectedAccount.data.email || '',
          title: disconnectedAccount.data.title || '',
          country: disconnectedAccount.data.country || 'us',
        },
      })
      toast.success('Payment account reconnected')
    } catch (err: any) {
      toast.error(parseConnectError(err, 'Failed to reconnect account'))
    }
  }

  const handleCreate = async () => {
    if (!companyName.trim()) return
    let session
    try {
      session = await authClient.getSession()
    } catch {
      toast.error('Failed to get session')
      return
    }
    const email = session.data?.user?.email
    if (!email) {
      toast.error('Unable to get user email')
      return
    }
    try {
      await whopConnect.mutateAsync({
        data: { email, title: companyName.trim(), country: 'us' },
      })
      toast.success('Payment account created')
      setCompanyName('')
    } catch (err: any) {
      toast.error(parseConnectError(err, 'Failed to create account'))
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="flex flex-col items-center w-full max-w-[300px] text-center">
        <div className="size-11 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center mb-5">
          <Coins className="size-5 text-[var(--brand)]" weight="duotone" />
        </div>

        <p className="text-[15px] font-semibold mb-1">Payments</p>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
          Accept payments and manage revenue from your AI agents.
        </p>

        {disconnectedAccount ? (
          <button
            type="button"
            onClick={handleReconnect}
            disabled={whopConnect.isPending}
            className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <div className="size-8 rounded-md border bg-muted/40 grid place-items-center shrink-0">
              <Image src="/surpay-coin.svg" alt="Surgent" width={20} height={20} />
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {disconnectedAccount.data.title || 'Untitled'}
              </div>
              <div className="text-xs text-muted-foreground">
                {whopConnect.isPending ? 'Reconnecting...' : 'Tap to reconnect'}
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                isLive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600',
              )}
            >
              {isLive ? 'Live' : 'Sandbox'}
            </span>
          </button>
        ) : (
          <div className="w-full space-y-2.5">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && companyName.trim()) handleCreate()
              }}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!companyName.trim() || whopConnect.isPending}
              className="w-full h-9 text-[13px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-all duration-100 disabled:opacity-40 flex items-center justify-center"
            >
              {whopConnect.isPending ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentsContent({ projectId }: { projectId?: string }) {
  const { data: accounts, isLoading } = useSurpayAccounts()
  const disconnect = useSurpayDisconnect()
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  if (isLoading) {
    return <LoadingState icon={CreditCard} message="Loading payment accounts..." />
  }

  const account = accounts?.find((a) => a.status === 'connected')
  const disconnected = accounts?.find((a) => a.status === 'disconnected')

  if (!account) {
    return <ConnectPaymentsView disconnectedAccount={disconnected} />
  }

  return (
    <>
      <ProductsSection
        projectId={projectId!}
        isConnected
        processor={account.processor}
        accountData={account.data}
        accountId={account.id}
        onDisconnect={() => setDisconnectOpen(true)}
        isDisconnecting={disconnect.isPending}
      />

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Payment Account</DialogTitle>
            <DialogDescription>This will disable payment processing.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => {
                disconnect.mutate(
                  { accountId: account.id },
                  { onSuccess: () => setDisconnectOpen(false) },
                )
              }}
            >
              {disconnect.isPending ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SandboxPausedContent({
  onActivate,
  isActivating,
}: {
  onActivate: () => void
  isActivating: boolean
}) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-muted p-4">
          <Power className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Sandbox Paused</p>
          <p className="text-sm text-muted-foreground">
            Your sandbox is paused to save resources. Activate it to resume your preview.
          </p>
        </div>
        <Button onClick={onActivate} disabled={isActivating} className="gap-2">
          {isActivating ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Power className="size-4" />
              Activate Sandbox
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// Get icon for tab type
function getTabIcon(type: PreviewTab['type']) {
  switch (type) {
    case 'preview':
      return Monitor
    case 'convex':
      return Database
    case 'changes':
      return GitCompare
    case 'logs':
      return ScrollText
    case 'payments':
      return CreditCard
  }
}

// Tab button component
function TabButton({
  tab,
  isActive,
  onSelect,
  onClose,
  isPulsing,
  connectedProcessor,
}: {
  tab: PreviewTab
  isActive: boolean
  onSelect: () => void
  onClose?: () => void
  isPulsing?: boolean
  connectedProcessor?: string
}) {
  const closable = tab.type !== 'preview' && tab.type !== 'convex' && tab.type !== 'payments'
  const Icon = getTabIcon(tab.type)
  const isProd = tab.convexEnv === 'production'

  const renderIcon = () => {
    if (tab.type === 'payments' && connectedProcessor) {
      return (
        <div className="size-4 rounded-sm border bg-muted/40 grid place-items-center overflow-hidden">
          <Image src="/surpay-coin.svg" alt="Surgent" width={12} height={12} />
        </div>
      )
    }
    return Icon ? <Icon className="size-4" /> : null
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-1.5 px-3 text-[13px] border-r border-border/40 transition-colors shrink-0',
        isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/50',
        isPulsing && 'animate-pulse bg-brand/15 ring-1 ring-inset ring-brand/40',
      )}
    >
      {renderIcon()}
      <span className="truncate max-w-32">{tab.title}</span>
      {tab.convexEnv && (
        <span
          className={cn(
            'px-1.5 py-0.5 text-[10px] font-medium rounded-full leading-none',
            isProd
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          )}
        >
          {isProd ? 'Prod' : 'Dev'}
        </span>
      )}
      {closable && onClose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted-foreground/20 transition-colors"
        >
          <X className="size-3" />
        </span>
      )}
    </button>
  )
}

interface PreviewPanelProps {
  projectId?: string
  project?: any
  onPreviewUrl?: (url: string | null) => void
  tabs?: PreviewTab[]
  activeTabId?: string
  onTabChange?: (tabId: string) => void
  onCloseTab?: (tabId: string) => void
  onAddTab?: (type: PreviewTab['type']) => void
}

export default function PreviewPanel({
  projectId,
  project,
  onPreviewUrl,
  tabs = DEFAULT_TABS,
  activeTabId = 'preview',
  onTabChange,
  onCloseTab,
  onAddTab,
}: PreviewPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const tab = activeTab ?? tabs[0]
  const type = tab?.type ?? 'preview'
  const pulsePaymentsTab = useSandbox((s) => s.pulsePaymentsTab)
  const setPulsePaymentsTab = useSandbox((s) => s.setPulsePaymentsTab)
  const activeSessionId = useSandbox((s) => (projectId ? s.activeSessionId[projectId] : undefined))

  // Fetch payment accounts to show provider logo in tab
  const { data: paymentAccounts } = useSurpayAccounts()
  const connectedPaymentAccount = paymentAccounts?.find((a) => a.status === 'connected')
  const connectedProcessor = connectedPaymentAccount?.processor

  // Fetch diffs for changes tab
  const shouldFetchDiffs = type === 'changes' && !tab?.diffs
  const diffSessionId = shouldFetchDiffs ? tab?.sessionId || activeSessionId : undefined
  const diffMessageId = shouldFetchDiffs ? tab?.messageId : undefined
  const { data: messageDiffs, isLoading: diffsLoading } = useSessionDiff(
    projectId,
    diffSessionId,
    diffMessageId,
  )

  const hasLogs = tabs.some((tab) => tab.type === 'logs')
  const hasPayments = tabs.some((tab) => tab.type === 'payments')

  // Get convex environment from active tab
  const convexEnv = tab?.convexEnv ?? 'development'
  const { data: convexCredentials, isLoading: convexLoading } = useConvexDashboardQuery(
    projectId,
    convexEnv,
    type === 'convex',
  )

  const { data: sandboxLogs, isLoading: logsLoading } = useSandboxLogsQuery(
    projectId,
    type === 'logs',
  )

  const url = project?.sandbox?.url
  const { data: health } = useSandboxHealthQuery(projectId, type === 'preview')

  // Ready only when URL exists AND health confirms sandbox is running
  const ready = Boolean(url) && health?.status === 'running'
  // Down only when health confirms sandbox is paused (show activate button)
  const down = health?.status === 'paused'

  const { mutate: activate, isPending: activating } = useActivateProject()

  useEffect(() => {
    onPreviewUrl?.(url ?? null)
  }, [url, onPreviewUrl])

  const handleUrlChange = (u: string) => {
    onPreviewUrl?.(u || null)
  }

  const nav = type === 'preview' && ready && !down

  const addTabMenu = onAddTab ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-full items-center px-2.5 text-sm border-r text-muted-foreground hover:bg-muted/50">
          <Plus className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuItem onClick={() => onAddTab('logs')} disabled={hasLogs} className="gap-2">
          <ScrollText className="size-4 text-muted-foreground" />
          Server Logs
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAddTab('payments')}
          disabled={hasPayments}
          className="gap-2"
        >
          <CreditCard className="size-4 text-muted-foreground" />
          Payments
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const body = (() => {
    switch (type) {
      case 'preview': {
        if (down) {
          return (
            <SandboxPausedContent
              onActivate={() => projectId && activate({ id: projectId })}
              isActivating={activating}
            />
          )
        }
        if (ready) return <WebPreviewBody className="w-full h-full border-0" />
        return <LoadingState message="Starting sandbox..." />
      }
      case 'convex':
        return (
          <ConvexContent
            credentials={convexCredentials}
            isLoading={convexLoading}
            path={tab?.convexPath}
          />
        )
      case 'changes': {
        const diffs = tab?.diffs ?? messageDiffs
        if (diffsLoading) return <LoadingState icon={GitCompare} message="Loading changes..." />
        if (!diffs) {
          if (tab?.messageId)
            return <LoadingState icon={GitCompare} message="Preparing changes..." />
          return (
            <EmptyState
              title="No changes"
              description="No file changes in this session"
              icon={GitCompare}
            />
          )
        }
        return diffs.length ? (
          <ChangesContent diffs={diffs} />
        ) : (
          <EmptyState title="No changes" description="No file changes" icon={GitCompare} />
        )
      }
      case 'logs':
        return (
          <LogsContent
            app={sandboxLogs?.app}
            opencode={sandboxLogs?.opencode}
            isLoading={logsLoading}
          />
        )
      case 'payments':
        return <PaymentsContent projectId={projectId} />
    }
  })()

  const content = (
    <div className="h-full flex flex-col relative">
      {/* Tab bar */}
      <div className="flex h-10 items-stretch border-b bg-muted/20 shrink-0">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTabId === tab.id}
              onSelect={() => {
                onTabChange?.(tab.id)
                if (tab.type === 'payments') setPulsePaymentsTab(false)
              }}
              onClose={onCloseTab ? () => onCloseTab(tab.id) : undefined}
              isPulsing={tab.type === 'payments' && pulsePaymentsTab}
              connectedProcessor={tab.type === 'payments' ? connectedProcessor : undefined}
            />
          ))}
          {addTabMenu}
        </div>
        {/* Nav controls - only render inside WebPreview context */}
        {nav && (
          <div className="flex items-center pr-2">
            <PreviewNavControls />
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {body}
        {type === 'preview' && <PreviewErrorOverlay />}
      </div>
    </div>
  )

  // Always wrap in WebPreview when we have a preview URL - keeps context stable
  if (url) {
    return (
      <WebPreview
        key={url}
        defaultUrl={url}
        onUrlChange={handleUrlChange}
        className="h-full border-0"
      >
        {content}
      </WebPreview>
    )
  }

  return content
}
