"use client"

import { WebPreview, WebPreviewNavButtons, WebPreviewUrl, WebPreviewBody } from "@/components/agent/web-preview"
import { useEffect, useMemo, useState, type ElementType } from "react"
import {
  X,
  Database,
  Monitor,
  CreditCard,
  GitCompare,
  Terminal,
  ScrollText,
  Plus,
  Power,
  RefreshCw,
} from "lucide-react"
import type { FileDiff, ToolPart } from "@opencode-ai/sdk"
import { useQuery } from "@tanstack/react-query"

import {
  useConvexDashboardQuery,
  useActivateProject,
  useSandboxHealthQuery,
  type ConvexDashboardCredentials,
} from "@/queries/projects"
import { useSessionsQuery } from "@/queries/chats"

import DiffView from "@/components/diff/diff-view"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"
import { http } from "@/lib/http"
import { useSandbox } from "@/hooks/use-sandbox"
import useAgentStream from "@/lib/use-agent-stream"
import { EmbeddedDashboard } from "@/components/agent/convex-dashboard"

export interface PreviewTab {
  id: string
  type: "preview" | "changes" | "convex" | "payments" | "mcp" | "logs"
  title: string
  diffs?: FileDiff[]
  messageId?: string
  convexPath?: string
}

const DEFAULT_TABS: PreviewTab[] = [
  { id: "preview", type: "preview", title: "Preview" },
  { id: "payments", type: "payments", title: "Payments" },
]

type McpStatusValue = { status?: string } | string

type McpStatus = Record<string, McpStatusValue>

function EmptyState({ title, description, icon: Icon }: { title: string; description: string; icon: ElementType }) {
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

const formatStatus = (status: string) => status.replace(/[_-]/g, " ")

const getStatusTone = (status: string) => {
  const value = status.toLowerCase()
  if (["ready", "running", "connected", "online", "ok", "healthy"].includes(value)) return "text-success"
  if (["warning", "degraded"].includes(value)) return "text-warning"
  if (["error", "failed", "offline", "disconnected", "down"].includes(value)) return "text-destructive"
  return "text-muted-foreground"
}

const getStatusDot = (status: string) => {
  const value = status.toLowerCase()
  if (["ready", "running", "connected", "online", "ok", "healthy"].includes(value)) return "bg-success"
  if (["warning", "degraded"].includes(value)) return "bg-warning"
  if (["error", "failed", "offline", "disconnected", "down"].includes(value)) return "bg-destructive"
  return "bg-muted-foreground/40"
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
        <span className="text-sm text-muted-foreground">Convex not configured for this project</span>
      </div>
    )
  }

  return <EmbeddedDashboard credentials={credentials} path={path || "data"} />
}

function ChangesContent({ diffs }: { diffs: FileDiff[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {diffs.map((d, i) => (
          <DiffView key={i} before={d.before} after={d.after} path={d.file} collapseUnchanged contextLines={3} />
        ))}
      </div>
    </ScrollArea>
  )
}

function PaymentsContent() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <CreditCard className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Payments</p>
          <p className="text-sm text-muted-foreground">Join waitlist · Private beta</p>
        </div>
      </div>
    </div>
  )
}

function LogsContent({ text }: { text: string }) {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto px-2 py-4 @md/conversation:px-4 @md/conversation:py-6">
        {text ? (
          <pre className="text-xs sm:text-sm font-mono whitespace-pre-wrap break-words text-foreground/90">{text}</pre>
        ) : (
          <EmptyState title="No logs yet" description="Run a dev-logs tool to see output" icon={ScrollText} />
        )}
      </div>
    </ScrollArea>
  )
}

function McpContent({ entries, isLoading }: { entries: Array<{ name: string; status: string }>; isLoading: boolean }) {
  if (isLoading) {
    return <LoadingState icon={Terminal} message="Loading MCP status..." />
  }

  if (!entries.length) {
    return <EmptyState title="No MCP servers" description="Connect an MCP server to see status" icon={Terminal} />
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
              <span className={cn("size-2 rounded-full", getStatusDot(entry.status))} />
              <span className="font-medium text-sm truncate">{entry.name}</span>
            </div>
            <span className={cn("text-xs font-medium capitalize", getStatusTone(entry.status))}>
              {formatStatus(entry.status)}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function SandboxPausedContent({ onActivate, isActivating }: { onActivate: () => void; isActivating: boolean }) {
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
function getTabIcon(type: PreviewTab["type"]) {
  switch (type) {
    case "preview":
      return Monitor
    case "convex":
      return Database
    case "payments":
      return CreditCard
    case "changes":
      return GitCompare
    case "mcp":
      return Terminal
    case "logs":
      return ScrollText
  }
}

// Tab button component
function TabButton({
  tab,
  isActive,
  onSelect,
  onClose,
}: {
  tab: PreviewTab
  isActive: boolean
  onSelect: () => void
  onClose?: () => void
}) {
  const isClosable = tab.type !== "preview" && tab.type !== "convex" && tab.type !== "payments"
  const Icon = getTabIcon(tab.type)

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 px-3 text-sm border-r transition-colors",
        isActive ? "bg-background text-foreground dark:bg-muted" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="truncate max-w-32">{tab.title}</span>
      {isClosable && onClose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-0.5 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
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
  onAddTab?: (type: PreviewTab["type"]) => void
}

export default function PreviewPanel({
  projectId,
  project,
  onPreviewUrl,
  tabs = DEFAULT_TABS,
  activeTabId = "preview",
  onTabChange,
  onCloseTab,
  onAddTab,
}: PreviewPanelProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const hasConvex = Boolean((project?.metadata as any)?.convex)
  const isConvexTabActive = activeTab?.type === "convex"
  const isPreviewTabActive = activeTab?.type === "preview"
  const isMcpTabActive = activeTab?.type === "mcp"
  const hasMcp = tabs.some((tab) => tab.type === "mcp")
  const hasLogs = tabs.some((tab) => tab.type === "logs")

  const storedSessionId = useSandbox((state) => (projectId ? state.activeSessionId[projectId] : undefined))
  const { data: sessions = [] } = useSessionsQuery(projectId)
  const activeId = storedSessionId && sessions.some((s) => s.id === storedSessionId) ? storedSessionId : sessions[0]?.id
  const { messages, parts } = useAgentStream({ projectId, sessionId: activeId })

  const { data: convexCredentials, isLoading: convexLoading } = useConvexDashboardQuery(
    projectId,
    hasConvex && isConvexTabActive,
  )

  const { data: mcpStatus, isLoading: mcpLoading } = useQuery<McpStatus>({
    queryKey: ["mcp-status"],
    enabled: isMcpTabActive,
    queryFn: async () => (await http.get("mcp").json()) as McpStatus,
  })

  const mcpEntries = useMemo(() => {
    if (!mcpStatus) return []
    return Object.entries(mcpStatus).map((entry) => {
      const name = entry[0]
      const value = entry[1]
      const status = typeof value === "string" ? value : value?.status || "unknown"
      return { name, status }
    })
  }, [mcpStatus])

  const isCompletedDevLog = (
    part: ToolPart,
  ): part is ToolPart & { tool: "dev-logs"; state: { status: "completed"; output: string; title: string } } =>
    part.tool === "dev-logs" &&
    part.state.status === "completed" &&
    typeof part.state.output === "string" &&
    typeof part.state.title === "string"

  const devLogsText = useMemo(() => {
    const toolParts = messages
      .flatMap((message) => parts[message.id] ?? [])
      .filter((part): part is ToolPart => part.type === "tool")
    const latest = [...toolParts].reverse().find(isCompletedDevLog)
    if (!latest) return ""
    const text = latest.state.output.trim()
    const title = latest.state.title.trim()
    if (!title) return text
    if (!text) return title
    return `${title}\n${text}`.trim()
  }, [messages, parts])

  const proxyHost = process.env.NEXT_PUBLIC_PROXY_URL
  const sandboxId = project?.sandbox?.id
  // Preview availability should not depend on SSE connectivity.
  const isReady = Boolean(sandboxId && proxyHost)
  const previewUrl = isReady ? `https://3000-${sandboxId}.${proxyHost}` : undefined

  const [currentUrl, setCurrentUrl] = useState("")

  const { data: health } = useSandboxHealthQuery(projectId, isPreviewTabActive)
  const sandboxDown = health && health.status !== "running"

  const { mutate: activate, isPending: activating } = useActivateProject()

  useEffect(() => {
    onPreviewUrl?.(previewUrl ?? null)
  }, [previewUrl, onPreviewUrl])

  useEffect(() => {
    if (!previewUrl) return
    if (currentUrl) return
    setCurrentUrl(previewUrl)
  }, [currentUrl, previewUrl])

  const handleUrlChange = (u: string) => {
    setCurrentUrl(u)
    onPreviewUrl?.(u || null)
  }

  // Content without WebPreview wrapper (for non-preview tabs)
  const renderContent = () => (
    <div className="h-full flex flex-col relative">
      {/* Tab bar */}
      <div className="flex h-10 items-stretch border-b bg-muted/30 dark:bg-background shrink-0">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div key={tab.id} className="flex items-stretch">
              <TabButton
                tab={tab}
                isActive={activeTabId === tab.id}
                onSelect={() => onTabChange?.(tab.id)}
                onClose={onCloseTab ? () => onCloseTab(tab.id) : undefined}
              />
            </div>
          ))}
          {onAddTab && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center px-2.5 text-sm border-l text-muted-foreground hover:bg-muted/50">
                  <Plus className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAddTab("mcp")} disabled={hasMcp}>
                  MCP
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddTab("logs")} disabled={hasLogs}>
                  Logs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {/* Nav controls on the right - only when preview tab is active and ready */}
        {isPreviewTabActive && isReady && previewUrl && (
          <div className="flex items-center pr-2">
            <PreviewNavControls />
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {isPreviewTabActive &&
          (sandboxDown ? (
            <SandboxPausedContent
              onActivate={() => projectId && activate({ id: projectId })}
              isActivating={activating}
            />
          ) : isReady && previewUrl ? (
            <WebPreviewBody className="w-full h-full border-0" />
          ) : (
            <LoadingState message="Starting sandbox..." />
          ))}

        {activeTab?.type === "convex" && (
          <ConvexContent credentials={convexCredentials} isLoading={convexLoading} path={activeTab.convexPath} />
        )}

        {activeTab?.type === "payments" && <PaymentsContent />}

        {activeTab?.type === "changes" && activeTab.diffs?.length && <ChangesContent diffs={activeTab.diffs} />}

        {activeTab?.type === "mcp" && <McpContent entries={mcpEntries} isLoading={mcpLoading} />}

        {activeTab?.type === "logs" && <LogsContent text={devLogsText} />}
      </div>
    </div>
  )

  // Wrap in WebPreview context when preview is ready and sandbox is up
  if (isPreviewTabActive && isReady && previewUrl && !sandboxDown) {
    return (
      <WebPreview key={previewUrl} defaultUrl={previewUrl} onUrlChange={handleUrlChange} className="h-full border-0">
        {renderContent()}
      </WebPreview>
    )
  }

  return renderContent()
}
