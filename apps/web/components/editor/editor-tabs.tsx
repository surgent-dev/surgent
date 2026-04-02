'use client'

import { CircleDollarSign, Database, Monitor, ScrollText, Settings } from 'lucide-react'
import { useState } from 'react'
import { EmbeddedDashboard } from '@/components/agent/convex-dashboard'
import { PreviewErrorOverlay } from '@/components/agent/preview-error-overlay'
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavButtons,
  WebPreviewNavigation,
  WebPreviewUrl,
} from '@/components/agent/web-preview'
import { PaymentsDashboard } from '@/components/payments/payments-dashboard'
import { SettingsTab } from '@/components/project/settings-tab'
import { DeviceFrameSelector } from '@/components/publish/device-frame-selector'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSandbox } from '@/hooks/use-sandbox'
import {
  useConvexDashboardQuery,
  useSandboxHealthQuery,
  useSandboxLogsQuery,
} from '@/queries/projects'

type Tab = 'preview' | 'database' | 'payments' | 'settings' | 'logs'

interface EditorTabsProps {
  projectId: string
  project?: {
    sandbox?: { id?: string; url?: string | null } | null
    [key: string]: unknown
  }
}

export default function EditorTabs({ projectId, project }: EditorTabsProps) {
  const [active, setActive] = useState<Tab>('preview')
  const deviceFrame = useSandbox((s) => s.deviceFrame)
  const setDeviceFrame = useSandbox((s) => s.setDeviceFrame)

  const url = project?.sandbox?.url || ''
  const { data: health } = useSandboxHealthQuery(projectId, active === 'preview')
  const ready = Boolean(url) && health?.status === 'running'

  return (
    <Tabs
      value={active}
      onValueChange={(v) => setActive(v as Tab)}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex shrink-0 items-center px-3 py-2">
        <TabsList>
          <TabsTrigger value="preview">
            <Monitor className="size-3.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="size-3.5" />
            Database
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CircleDollarSign className="size-3.5" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-3.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="size-3.5" />
            Logs
          </TabsTrigger>
        </TabsList>
        <div className="flex-1" />
        {active === 'preview' && ready && (
          <DeviceFrameSelector
            value={(deviceFrame as 'mobile' | 'tablet' | 'desktop') ?? 'desktop'}
            onChange={(f) => setDeviceFrame(f === 'desktop' ? null : f)}
          />
        )}
      </div>

      <div className="min-h-0 flex-1">
        {active === 'preview' && <PreviewContent url={url} ready={ready} />}
        {active === 'database' && <DatabaseContent projectId={projectId} />}
        {active === 'payments' && <PaymentsDashboard projectId={projectId} />}
        {active === 'settings' && <SettingsTab projectId={projectId} />}
        {active === 'logs' && <LogsContent projectId={projectId} />}
      </div>
    </Tabs>
  )
}

function PreviewContent({ url, ready }: { url: string; ready: boolean }) {
  if (!ready) return <Empty title="Starting" detail="Preparing the environment…" />

  return (
    <WebPreview key={url} defaultUrl={url} className="h-full border-0 rounded-none">
      <WebPreviewNavigation className="border-b border-border/40 px-2">
        <WebPreviewNavButtons />
        <WebPreviewUrl className="flex-1 max-w-none" />
      </WebPreviewNavigation>
      <WebPreviewBody className="size-full" />
      <PreviewErrorOverlay />
    </WebPreview>
  )
}

function DatabaseContent({ projectId }: { projectId: string }) {
  const {
    data: credentials,
    isLoading,
    isError,
  } = useConvexDashboardQuery(projectId, 'development', true)

  if (isLoading) return <Empty title="Loading" detail="Connecting to database…" />
  if (isError || !credentials)
    return (
      <Empty
        icon={Database}
        title="No database"
        detail="This project doesn't have a database configured yet."
      />
    )

  return <EmbeddedDashboard credentials={credentials} path="data" />
}

function LogsContent({ projectId }: { projectId: string }) {
  const { data: logs, isLoading } = useSandboxLogsQuery(projectId, true)

  if (isLoading) return <Empty title="Loading" detail="Fetching logs…" />
  if (!logs?.app && !logs?.opencode)
    return (
      <Empty
        icon={ScrollText}
        title="No logs yet"
        detail="Logs appear when processes are running."
      />
    )

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {logs.app && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">App Server</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-xs font-mono text-foreground/80">
              {logs.app.trim() || 'No output'}
            </pre>
          </div>
        )}
        {logs.opencode && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">AI Server</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-xs font-mono text-foreground/80">
              {logs.opencode.trim() || 'No output'}
            </pre>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function Empty({
  title,
  detail,
  icon: Icon,
}: {
  title: string
  detail: string
  icon?: typeof Monitor
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {Icon && (
        <div className="mb-3 rounded-full bg-muted p-3">
          <Icon className="size-5 text-muted-foreground/40" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/50">{detail}</p>
    </div>
  )
}
