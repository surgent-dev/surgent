'use client'

import {
  WebPreview,
  WebPreviewNavButtons,
  WebPreviewUrl,
  WebPreviewBody,
} from '@/components/agent/web-preview'
import { useEffect, useMemo, useState, type ElementType } from 'react'
import {
  X,
  Database,
  Monitor,
  GitCompare,
  Terminal,
  ScrollText,
  Plus,
  Power,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import type { FileDiff } from '@opencode-ai/sdk'
import { useQuery } from '@tanstack/react-query'

import {
  useConvexDashboardQuery,
  useActivateProject,
  useSandboxHealthQuery,
  useSandboxLogsQuery,
  type ConvexDashboardCredentials,
} from '@/queries/projects'

import { useSurpayAccounts, useSurpayConnect, useSurpayDisconnect } from '@/queries/surpay'
import { useSessionDiff } from '@/queries/chats'
import { useSandbox } from '@/hooks/use-sandbox'

import DiffView from '@/components/diff/diff-view'
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
  DialogTrigger,
} from '@/components/ui/dialog'

import { cn } from '@/lib/utils'
import { http } from '@/lib/http'
import { EmbeddedDashboard } from '@/components/agent/convex-dashboard'

export interface PreviewTab {
  id: string
  type: 'preview' | 'changes' | 'convex' | 'mcp' | 'logs' | 'payments'
  title: string
  diffs?: FileDiff[]
  messageId?: string
  sessionId?: string
  convexPath?: string
}

const DEFAULT_TABS: PreviewTab[] = [{ id: 'preview', type: 'preview', title: 'Preview' }]

type McpStatusValue = { status?: string } | string

type McpStatus = Record<string, McpStatusValue>

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

// Loading spinner component
function LoadingState({ icon: Icon, message }: { icon?: typeof Database; message: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        {Icon ? (
          <Icon className="h-8 w-8 animate-pulse" />
        ) : (
          <div className="h-8 w-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        )}
        <span>{message}</span>
      </div>
    </div>
  )
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

function McpContent({
  entries,
  isLoading,
}: {
  entries: Array<{ name: string; status: string }>
  isLoading: boolean
}) {
  if (isLoading) {
    return <LoadingState icon={Terminal} message="Loading MCP status..." />
  }

  if (!entries.length) {
    return (
      <EmptyState
        title="No MCP servers"
        description="Connect an MCP server to see status"
        icon={Terminal}
      />
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-3 py-4 space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('size-2 rounded-full', getStatusDot(entry.status))} />
              <span className="font-medium text-sm truncate">{entry.name}</span>
            </div>
            <span className={cn('text-xs font-medium capitalize', getStatusTone(entry.status))}>
              {formatStatus(entry.status)}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function PaymentsContent({ projectId }: { projectId?: string }) {
  const { data: accounts, isLoading } = useSurpayAccounts(projectId)
  const connect = useSurpayConnect()
  const disconnect = useSurpayDisconnect()
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)

  if (isLoading) {
    return <LoadingState icon={CreditCard} message="Loading payment accounts..." />
  }

  const handleConnect = async () => {
    if (!projectId) return
    const result = await connect.mutateAsync(projectId)
    if (result.oauth_url) {
      window.location.href = result.oauth_url
    }
  }

  if (!accounts?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-muted p-4">
            <CreditCard className="size-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Connect Payments</p>
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account to accept payments
            </p>
          </div>
          <Button onClick={handleConnect} disabled={connect.isPending}>
            {connect.isPending ? 'Connecting...' : 'Connect Stripe'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-3 py-4 space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('size-2 rounded-full', getStatusDot(account.status))} />
              <span className="font-medium text-sm truncate">{account.processor}</span>
            </div>
            {account.status === 'pending' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnect}
                disabled={connect.isPending}
                className="h-6 text-xs"
              >
                {connect.isPending ? 'Connecting...' : 'Continue Setup'}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <span
                  className={cn('text-xs font-medium capitalize', getStatusTone(account.status))}
                >
                  {formatStatus(account.status)}
                </span>
                <Dialog
                  open={disconnectOpen && selectedAccount === account.id}
                  onOpenChange={(open) => {
                    setDisconnectOpen(open)
                    if (!open) setSelectedAccount(null)
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setSelectedAccount(account.id)}
                    >
                      Disconnect
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disconnect Stripe Account</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to disconnect your Stripe account? This will disable
                        payment processing for this project.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (projectId) {
                            disconnect.mutate({ projectId, accountId: account.id })
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
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
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
    case 'mcp':
      return Terminal
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
}: {
  tab: PreviewTab
  isActive: boolean
  onSelect: () => void
  onClose?: () => void
  isPulsing?: boolean
}) {
  const closable = tab.type !== 'preview' && tab.type !== 'convex'
  const Icon = getTabIcon(tab.type)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-1.5 px-2.5 text-sm border-r transition-colors shrink-0',
        isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-muted/50',
        isPulsing && 'animate-pulse bg-brand/15 ring-1 ring-inset ring-brand/40',
      )}
    >
      {Icon && <Icon className="size-4" />}
      <span className="truncate max-w-32">{tab.title}</span>
      {closable && onClose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="hidden group-hover:block p-0.5 rounded hover:bg-muted-foreground/20"
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

  // Fetch diffs for changes tab
  const shouldFetchDiffs = type === 'changes' && !tab?.diffs && !tab?.messageId
  const diffSessionId = shouldFetchDiffs ? tab?.sessionId || activeSessionId : undefined
  const diffMessageId = shouldFetchDiffs && tab?.messageId ? tab.messageId : undefined
  const { data: messageDiffs, isLoading: diffsLoading } = useSessionDiff(
    projectId,
    diffSessionId,
    diffMessageId,
  )

  const hasConvex = Boolean((project?.metadata as any)?.convex)
  const hasMcp = tabs.some((tab) => tab.type === 'mcp')
  const hasLogs = tabs.some((tab) => tab.type === 'logs')

  const { data: convexCredentials, isLoading: convexLoading } = useConvexDashboardQuery(
    projectId,
    hasConvex && type === 'convex',
  )

  const { data: mcpStatus, isLoading: mcpLoading } = useQuery<McpStatus>({
    queryKey: ['mcp-status'],
    enabled: type === 'mcp',
    queryFn: async () => (await http.get('mcp').json()) as McpStatus,
  })

  const { data: sandboxLogs, isLoading: logsLoading } = useSandboxLogsQuery(
    projectId,
    type === 'logs',
  )

  const mcpEntries = useMemo(() => {
    if (!mcpStatus) return []
    return Object.entries(mcpStatus).map((entry) => {
      const name = entry[0]
      const value = entry[1]
      const status = typeof value === 'string' ? value : value?.status || 'unknown'
      return { name, status }
    })
  }, [mcpStatus])

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
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onAddTab('mcp')} disabled={hasMcp} className="gap-2">
          <span className="text-base leading-none font-mono text-muted-foreground">&gt;_</span>
          MCP
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddTab('logs')} disabled={hasLogs} className="gap-2">
          <span className="text-sm leading-none text-muted-foreground">📜︎</span>
          Server Logs
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
      case 'mcp':
        return <McpContent entries={mcpEntries} isLoading={mcpLoading} />
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
      <div className="flex-1 min-h-0 flex flex-col">{body}</div>
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
