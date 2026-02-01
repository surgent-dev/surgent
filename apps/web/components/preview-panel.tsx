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
import Image from 'next/image'
import { Coins } from '@phosphor-icons/react'
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
  useSurpayConnect,
  useSurpayDisconnect,
  useWhopConnect,
  useUserWhopAccounts,
  type UserSurpayAccount,
} from '@/queries/surpay'
import { useSessionDiff } from '@/queries/chats'
import { useSandbox } from '@/hooks/use-sandbox'

import DiffView from '@/components/diff/diff-view'
import { ProductsSection } from '@/components/payments/products-section'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

function PaymentsContent({ projectId }: { projectId?: string }) {
  const { data: accounts, isLoading } = useSurpayAccounts(projectId)
  const connect = useSurpayConnect()
  const whopConnect = useWhopConnect()
  const disconnect = useSurpayDisconnect()
  const userWhopAccounts = useUserWhopAccounts()
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [surgentWaitlist, setSurgentWaitlist] = useState(false)
  const [surgentLoading, setSurgentLoading] = useState(false)
  const [whopDialogOpen, setWhopDialogOpen] = useState(false)
  const [whopAccountSelectOpen, setWhopAccountSelectOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    if (localStorage.getItem('surgent-pay-waitlist') === 'true') setSurgentWaitlist(true)
  }, [])

  const joinSurgentWaitlist = () => {
    setSurgentLoading(true)
    setTimeout(() => {
      localStorage.setItem('surgent-pay-waitlist', 'true')
      setSurgentWaitlist(true)
      setSurgentLoading(false)
    }, 1500)
  }

  if (isLoading) {
    return <LoadingState icon={CreditCard} message="Loading payment accounts..." />
  }

  const showConnectError = (err: Error, fallback: string) => {
    const msg = err?.message || ''
    const match = msg.match(/PROCESSOR_ALREADY_CONNECTED:(\w+)/)
    if (match) {
      toast.error(`Already connected to ${match[1]}. Disconnect it first.`)
    } else {
      toast.error(fallback)
    }
  }

  const handleConnect = async () => {
    if (!projectId) return
    try {
      const result = await connect.mutateAsync(projectId)
      if (result.oauthUrl) {
        window.location.href = result.oauthUrl
      }
    } catch (err: any) {
      showConnectError(err, 'Failed to connect Stripe')
    }
  }

  const handleConnectWhop = async () => {
    try {
      const result = await userWhopAccounts.refetch()
      const disconnected = (result.data ?? []).filter(
        (a) => a.status === 'disconnected' && a.projectId === null,
      )
      if (disconnected.length > 0) {
        setWhopAccountSelectOpen(true)
        return
      }
    } catch {
      // API may not be available yet, fall through to create new
    }
    setCompanyName('')
    setWhopDialogOpen(true)
  }

  const handleReconnectWhop = async (account: UserSurpayAccount) => {
    if (!projectId) return
    try {
      await whopConnect.mutateAsync({
        projectId,
        accountId: account.id,
        data: {
          email: account.email || '',
          title: account.title || '',
          country: account.country || 'us',
        },
      })
      toast.success('Whop reconnected successfully')
      setWhopAccountSelectOpen(false)
    } catch (err: any) {
      showConnectError(err, 'Failed to reconnect Whop')
    }
  }

  const handleWhopSubmit = async () => {
    if (!projectId || !companyName.trim()) return
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
        projectId,
        data: { email, title: companyName.trim(), country: 'us' },
      })
      toast.success('Whop connected successfully')
      setWhopDialogOpen(false)
    } catch (err: any) {
      showConnectError(err, 'Failed to connect Whop')
    }
  }

  if (!accounts?.length) {
    return (
      <>
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4 w-72">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <Coins className="size-6 text-muted-foreground" weight="duotone" />
              </div>
              <div className="text-center space-y-0.5">
                <p className="font-medium">Start earning</p>
                <p className="text-xs text-muted-foreground">Connect a payment provider</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={handleConnect}
                disabled={connect.isPending}
                className="flex items-center gap-3 w-full p-3 rounded-lg border bg-background/60 hover:bg-muted/50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <div className="grid place-items-center size-9 rounded-md overflow-hidden shrink-0">
                  <Image src="/Stripe_icon_-_square.svg" alt="Stripe" width={36} height={36} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium leading-tight">
                    {connect.isPending ? 'Connecting...' : 'Stripe'}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    Cards, Apple Pay, Google Pay
                  </span>
                </div>
              </button>
              <button
                onClick={handleConnectWhop}
                disabled={whopConnect.isPending}
                className="flex items-center gap-3 w-full p-3 rounded-lg border bg-background/60 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="grid place-items-center size-9 rounded-md bg-[#FF6243] shrink-0">
                  <Image
                    src="/whop_logo_brandmark_orange.svg"
                    alt="Whop"
                    width={22}
                    height={11}
                    className="brightness-0 invert"
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium leading-tight">
                    {whopConnect.isPending ? 'Connecting...' : 'Whop'}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    Memberships, courses, downloads
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <button
                onClick={surgentWaitlist || surgentLoading ? undefined : joinSurgentWaitlist}
                disabled={surgentWaitlist || surgentLoading}
                className="flex items-center gap-3 w-full p-3 rounded-lg border bg-background/60 hover:bg-muted/50 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-background/60"
              >
                <div className="grid place-items-center size-9 rounded-md overflow-hidden shrink-0">
                  <Image src="/surpay-coin.svg" alt="Surgent Pay" width={36} height={36} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium leading-tight flex items-center gap-1.5">
                    {surgentLoading ? (
                      <>
                        <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Joining...
                      </>
                    ) : surgentWaitlist ? (
                      'On waitlist ✓'
                    ) : (
                      'Surgent Pay'
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {surgentLoading
                      ? 'Adding you to the list'
                      : surgentWaitlist
                        ? "We'll notify you when ready"
                        : 'Native payments by Surgent'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <Dialog open={whopDialogOpen} onOpenChange={setWhopDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Whop</DialogTitle>
              <DialogDescription>
                Enter your company name to create your Whop account.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="My Company"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && companyName.trim()) {
                    handleWhopSubmit()
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWhopDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleWhopSubmit}
                disabled={!companyName.trim() || whopConnect.isPending}
              >
                {whopConnect.isPending ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={whopAccountSelectOpen} onOpenChange={setWhopAccountSelectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Whop Account</DialogTitle>
              <DialogDescription>
                Reconnect an existing account or create a new one.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              {userWhopAccounts.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {(userWhopAccounts.data ?? [])
                    .filter((a) => a.status === 'disconnected' && a.projectId === null)
                    .map((account) => (
                      <button
                        key={account.id}
                        onClick={() => handleReconnectWhop(account)}
                        disabled={whopConnect.isPending}
                        className="flex items-center gap-3 w-full p-3 rounded-lg border bg-background/60 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <div className="grid place-items-center size-9 rounded-md bg-[#FF6243] shrink-0">
                          <Image
                            src="/whop_logo_brandmark_orange.svg"
                            alt="Whop"
                            width={22}
                            height={11}
                            className="brightness-0 invert"
                          />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-sm font-medium leading-tight truncate">
                            {account.title || 'Whop Account'}
                          </span>
                          <span className="text-xs text-muted-foreground leading-tight truncate">
                            {[account.email, account.country?.toUpperCase()]
                              .filter(Boolean)
                              .join(' · ') || 'Disconnected'}
                          </span>
                        </div>
                      </button>
                    ))}
                  <button
                    onClick={() => {
                      setWhopAccountSelectOpen(false)
                      setCompanyName('')
                      setWhopDialogOpen(true)
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed bg-background/60 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="grid place-items-center size-9 rounded-md bg-muted shrink-0">
                      <Plus className="size-5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium leading-tight">Create new account</span>
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  const hasConnectedAccount = accounts.some((a) => a.status === 'connected')

  const connectedAccount = accounts.find((a) => a.status === 'connected')

  const handleDisconnect = () => {
    if (projectId && connectedAccount) {
      setSelectedAccount(connectedAccount.id)
      setDisconnectOpen(true)
    }
  }

  return (
    <>
      {hasConnectedAccount && projectId ? (
        <ProductsSection
          projectId={projectId}
          stripeConnected={hasConnectedAccount}
          stripeProcessor={connectedAccount?.processor}
          onDisconnect={handleDisconnect}
          isDisconnecting={disconnect.isPending}
        />
      ) : (
        <div className="px-3 py-4 space-y-2 max-w-xl mx-auto">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('size-2 rounded-full', getStatusDot(account.status))} />
                <span className="font-medium text-sm truncate">{account.processor}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnect}
                disabled={connect.isPending}
                className="h-6 text-xs"
              >
                {connect.isPending ? 'Connecting...' : 'Continue Setup'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={disconnectOpen}
        onOpenChange={(open) => {
          setDisconnectOpen(open)
          if (!open) setSelectedAccount(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {connectedAccount?.processor || 'Payment'} Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your {connectedAccount?.processor || 'payment'}{' '}
              account? This will disable payment processing for this project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (projectId && selectedAccount) {
                  disconnect.mutate({ projectId, accountId: selectedAccount })
                  setDisconnectOpen(false)
                }
              }}
              disabled={disconnect.isPending}
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
      if (connectedProcessor === 'stripe') {
        return (
          <Image
            src="/Stripe_icon_-_square.svg"
            alt="Stripe"
            width={16}
            height={16}
            className="size-4 rounded-sm"
          />
        )
      }
      if (connectedProcessor === 'whop') {
        return (
          <div className="size-4 rounded-sm bg-[#FF6243] grid place-items-center">
            <Image
              src="/whop_logo_brandmark_orange.svg"
              alt="Whop"
              width={10}
              height={5}
              className="brightness-0 invert"
            />
          </div>
        )
      }
    }
    return Icon ? <Icon className="size-4" /> : null
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-1.5 px-2.5 text-sm border-r transition-colors shrink-0',
        isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-muted/50',
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
  const { data: paymentAccounts } = useSurpayAccounts(projectId)
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
  const ready = Boolean(url)

  const { data: health } = useSandboxHealthQuery(projectId, type === 'preview')
  const down = Boolean(health && health.status !== 'running')

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
      <div className="flex h-10 items-stretch border-b bg-muted/30 shrink-0">
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
