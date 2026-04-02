'use client'

import type { FileDiff } from '@opencode-ai/sdk'
import {
  ChevronDown,
  CircleDollarSign,
  Database,
  GitCompare,
  Monitor,
  Plus,
  Power,
  RefreshCw,
  ScrollText,
  Settings,
  Terminal,
  X,
} from 'lucide-react'
import { type ElementType, useEffect } from 'react'
import { EmbeddedDashboard } from '@/components/agent/convex-dashboard'
import { PreviewErrorOverlay } from '@/components/agent/preview-error-overlay'
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavButtons,
  WebPreviewUrl,
} from '@/components/agent/web-preview'
import DiffView from '@/components/diff/diff-view'
import { PaymentsDashboard } from '@/components/payments/payments-dashboard'
import { SettingsTab } from '@/components/project/settings-tab'
import { DeviceFrameSelector } from '@/components/publish/device-frame-selector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FunLoadingState } from '@/components/ui/fun-loading'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSandbox } from '@/hooks/use-sandbox'
import { cn } from '@/lib/utils'
import { useSessionDiff } from '@/queries/chats'
import {
  type ConvexDashboardCredentials,
  useActivateProject,
  useConvexDashboardQuery,
  useSandboxHealthQuery,
  useSandboxLogsQuery,
} from '@/queries/projects'
import { useSurpayAccounts } from '@/queries/surpay'

export interface ProjectTab {
  id: string
  type: 'preview' | 'changes' | 'convex' | 'logs' | 'payments' | 'settings'
  title: string
  diffs?: FileDiff[]
  messageId?: string
  sessionId?: string
  convexPath?: string
  convexEnv?: 'development' | 'production'
  convexEnvs?: ('development' | 'production')[]
}

const DEFAULT_TABS: ProjectTab[] = [{ id: 'preview', type: 'preview', title: 'Preview' }]

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

function LoadingState(_props: { icon?: typeof Database; message?: string }) {
  return <FunLoadingState />
}

function DeviceFrameControls() {
  const deviceFrame = useSandbox((s) => s.deviceFrame)
  const setDeviceFrame = useSandbox((s) => s.setDeviceFrame)

  return (
    <DeviceFrameSelector
      value={deviceFrame ?? 'desktop'}
      onChange={(frame) => setDeviceFrame(frame === 'desktop' ? null : frame)}
    />
  )
}

function BrowserNavControls() {
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

function getTabIcon(type: ProjectTab['type']) {
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
      return CircleDollarSign
    case 'settings':
      return Settings
  }
}

function TabButton({
  tab,
  isActive,
  onSelect,
  onClose,
  isPulsing,
  connectedProcessor,
  onConvexEnvChange,
}: {
  tab: ProjectTab
  isActive: boolean
  onSelect: () => void
  onClose?: () => void
  isPulsing?: boolean
  connectedProcessor?: string
  onConvexEnvChange?: (env: 'development' | 'production') => void
}) {
  const closable =
    tab.type !== 'preview' &&
    tab.type !== 'convex' &&
    tab.type !== 'payments' &&
    tab.type !== 'settings'
  const Icon = getTabIcon(tab.type)
  const isProd = tab.convexEnv === 'production'
  const hasMultipleEnvs = tab.convexEnvs && tab.convexEnvs.length > 1

  const renderIcon = () => {
    if (tab.type === 'payments' && connectedProcessor) {
      return <CircleDollarSign className="size-4" />
    }
    return Icon ? <Icon className="size-4" /> : null
  }

  const envBadge = tab.convexEnv ? (
    <span
      className={cn(
        'px-2 py-1 text-[11px] font-medium rounded-full leading-none',
        isProd
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      )}
    >
      {isProd ? 'Prod' : 'Dev'}
    </span>
  ) : null

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-1.5 px-3 text-[13px] border-r border-border/40 transition-colors shrink-0 cursor-pointer',
        isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/50',
        isPulsing && 'animate-pulse bg-brand/15 ring-1 ring-inset ring-brand/40',
      )}
    >
      {renderIcon()}
      <span className="truncate max-w-32">{tab.title}</span>
      {hasMultipleEnvs ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex items-center gap-0.5 pl-2 pr-1.5 py-1 rounded-full text-[11px] font-medium leading-none transition-all',
                isProd
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25',
              )}
            >
              {isProd ? 'Prod' : 'Dev'}
              <ChevronDown className="size-2.5 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            {tab.convexEnvs!.map((env) => (
              <DropdownMenuItem
                key={env}
                onClick={() => onConvexEnvChange?.(env)}
                className={cn('gap-2 text-xs', tab.convexEnv === env && 'font-medium')}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    env === 'production' ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                />
                {env === 'production' ? 'Production' : 'Development'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        envBadge
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
    </div>
  )
}

interface ProjectToolsProps {
  projectId?: string
  project?: any
  onPreviewUrl?: (url: string | null) => void
  tabs?: ProjectTab[]
  activeTabId?: string
  onTabChange?: (tabId: string) => void
  onCloseTab?: (tabId: string) => void
  onAddTab?: (type: ProjectTab['type']) => void
  onConvexEnvChange?: (env: 'development' | 'production') => void
}

export default function ProjectTools({
  projectId,
  project,
  onPreviewUrl,
  tabs = DEFAULT_TABS,
  activeTabId = 'preview',
  onTabChange,
  onCloseTab,
  onAddTab,
  onConvexEnvChange,
}: ProjectToolsProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const tab = activeTab ?? tabs[0]
  const type = tab?.type ?? 'preview'
  const pulsePaymentsTab = useSandbox((s) => s.pulsePaymentsTab)
  const setPulsePaymentsTab = useSandbox((s) => s.setPulsePaymentsTab)
  const activeSessionId = useSandbox((s) => (projectId ? s.activeSessionId[projectId] : undefined))

  const { data: paymentAccounts } = useSurpayAccounts()
  const connectedPaymentAccount = paymentAccounts?.find((a) => a.status === 'connected')
  const connectedProcessor = connectedPaymentAccount?.processor

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

  const ready = Boolean(url) && health?.status === 'running'
  const down = health?.status === 'paused'

  const { mutate: activate, isPending: activating } = useActivateProject()

  useEffect(() => {
    onPreviewUrl?.(url ?? null)
  }, [url, onPreviewUrl])

  const handleUrlChange = (u: string) => {
    onPreviewUrl?.(u || null)
  }

  const showBrowserNav = type === 'preview' && ready && !down

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
          <CircleDollarSign className="size-4 text-muted-foreground" />
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
        return <PaymentsDashboard projectId={projectId} />
      case 'settings':
        return <SettingsTab projectId={projectId} />
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
              onConvexEnvChange={tab.type === 'convex' ? onConvexEnvChange : undefined}
            />
          ))}
          {addTabMenu}
        </div>
        {showBrowserNav && (
          <div className="flex items-center gap-2 pr-2">
            <BrowserNavControls />
            <DeviceFrameControls />
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
