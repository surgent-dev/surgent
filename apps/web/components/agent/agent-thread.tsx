'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import type {
  Message,
  Part,
  Permission,
  TextPart,
  ToolPart,
  ReasoningPart,
  FilePart,
  PatchPart,
  FileDiff,
} from '@opencode-ai/sdk'

// Type guards
function isToolPart(p: Part): p is ToolPart {
  return p.type === 'tool'
}

function isPatchPart(p: Part): p is PatchPart {
  return p.type === 'patch'
}

function isTextPart(p: Part): p is TextPart {
  return p.type === 'text'
}

function isFilePart(p: Part): p is FilePart {
  return p.type === 'file'
}

function isReasoningPart(p: Part): p is ReasoningPart {
  return p.type === 'reasoning'
}

// Utility for safely accessing input from non-pending tool state
function getToolInput(part: ToolPart): Record<string, unknown> | undefined {
  if (part.state.status === 'pending') return undefined
  return part.state.input as Record<string, unknown>
}

// Utility for safely accessing object values
function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  Database,
  Eye,
  FilePenLine,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  Play,
  Search,
  Terminal,
  Trash2,
  Undo2,
} from 'lucide-react'
import { MagicWand, Code, Rocket, Terminal as TerminalPh, CheckCircle } from '@phosphor-icons/react'
import { ShimmeringText } from '@/components/ui/shimmer-text'
import { FunWorkingText } from '@/components/ui/fun-loading'
import { Markdown } from '@/components/ui/markdown'
import { useRespondPermission } from '@/queries/chats'
import useAgentStream from '@/lib/use-agent-stream'
import { computeWorkingFromParts } from '@/lib/agent-working'
import { useSandbox } from '@/hooks/use-sandbox'
import MessageDiffBadge from './message-diff-badge'

type PermissionResponse = 'once' | 'always' | 'reject'

type ToolConfig = { icon: React.ElementType; done: string; doing: string | null }

const TOOLS: Record<string, ToolConfig> = {
  read: { icon: Eye, done: 'Read', doing: 'Reading...' },
  write: { icon: FileText, done: 'Created', doing: 'Creating...' },
  edit: { icon: FilePenLine, done: 'Edited', doing: 'Editing...' },
  delete: { icon: Trash2, done: 'Deleted', doing: 'Deleting...' },
  bash: { icon: Terminal, done: 'Ran', doing: 'Running...' },
  grep: { icon: Search, done: 'Searched', doing: 'Searching...' },
  glob: { icon: Search, done: 'Searched', doing: 'Searching...' },
  list: { icon: Search, done: 'Listed', doing: 'Listing...' },
  webfetch: { icon: Globe, done: 'Fetched', doing: 'Fetching...' },
  websearch: { icon: Globe, done: 'Web Search', doing: 'Searching web...' },
  codesearch: { icon: Code, done: 'Code Search', doing: 'Searching code...' },
  skill: { icon: MagicWand, done: 'Skill', doing: 'Running skill...' },
  todowrite: { icon: ListTodo, done: 'Todos', doing: 'Updating...' },
  todoread: { icon: ListTodo, done: 'Todos', doing: 'Loading...' },
  task: { icon: Terminal, done: 'Task', doing: 'Running...' },
  dev: { icon: Rocket, done: 'Started', doing: 'Starting...' },
  'dev-run': { icon: Rocket, done: 'Dev Server', doing: 'Running Development Server...' },
  devLogs: { icon: TerminalPh, done: 'Logs', doing: 'Loading...' },
}

// MCP server configs for better display
const MCP_SERVERS: Record<string, { icon: React.ElementType; label: string }> = {
  convex: { icon: Database, label: 'Convex' },
  pay: { icon: Database, label: 'Pay' },
  stripe: { icon: Database, label: 'Stripe' },
  supabase: { icon: Database, label: 'Supabase' },
  firebase: { icon: Database, label: 'Firebase' },
}

function getMcpInfo(tool: string): { server: string; action: string } | undefined {
  const index = tool.indexOf('_')
  if (index <= 0) return undefined
  const server = tool.slice(0, index)
  const action = tool.slice(index + 1)
  if (!server || !action) return undefined
  return { server, action }
}

function formatActionName(action: string): string {
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getToolConfig(tool: string): ToolConfig {
  const cfg = TOOLS[tool]
  if (cfg) return cfg

  // Check if it's an MCP tool (server_action format)
  const mcpInfo = getMcpInfo(tool)
  if (mcpInfo) {
    const serverCfg = MCP_SERVERS[mcpInfo.server]
    if (serverCfg) {
      const actionLabel = formatActionName(mcpInfo.action)
      return {
        icon: serverCfg.icon,
        done: `${serverCfg.label}: ${actionLabel}`,
        doing: `${serverCfg.label}: ${actionLabel}...`,
      }
    }
    // Unknown MCP server - show generic format
    const actionLabel = formatActionName(mcpInfo.action)
    return {
      icon: Database,
      done: `${mcpInfo.server}: ${actionLabel}`,
      doing: `${mcpInfo.server}: ${actionLabel}...`,
    }
  }

  return { icon: FileText, done: tool, doing: null }
}

function getTarget(part: ToolPart): string | undefined {
  const input = getToolInput(part)
  if (!input) return undefined

  // File operations
  if (['read', 'write', 'edit'].includes(part.tool))
    return String(input.filePath || '')
      .split(/[/\\]/)
      .pop()

  // Command tools
  if (['bash', 'dev', 'dev-run'].includes(part.tool)) return String(input.command || '')

  // Task/subagent
  if (part.tool === 'task') return String(input.description || input.subagent_type || '')

  // Search tools
  if (part.tool === 'grep') return String(input.pattern || '')
  if (part.tool === 'glob') return String(input.pattern || '')
  if (part.tool === 'list') return String(input.path || '/')
  if (part.tool === 'codesearch' || part.tool === 'websearch')
    return String(input.query || input.q || '')

  // Web fetch
  if (part.tool === 'webfetch') {
    const url = String(input.url || '')
    if (typeof URL.canParse === 'function' && URL.canParse(url)) return new URL(url).hostname
    return url
  }

  // Skill - show which skill is being used
  if (part.tool === 'skill') {
    const skillName = String(input.skill || input.name || '')
    return skillName ? `/${skillName}` : undefined
  }

  // MCP tools (convex_*, pay_*, etc.)
  const mcpInfo = getMcpInfo(part.tool)
  if (mcpInfo) {
    // Try to get a meaningful target from input
    if (typeof input.name === 'string') return input.name
    if (typeof input.path === 'string') return input.path
    if (typeof input.projectId === 'string') return input.projectId
    if (typeof input.query === 'string') return input.query
    if (typeof input.id === 'string') return input.id
    return undefined
  }
}

function getSessionId(value?: unknown): string | undefined {
  const meta = asRecord(value)
  if (!meta) return undefined
  if (typeof meta.sessionId === 'string') return meta.sessionId
  if (typeof meta.sessionID === 'string') return meta.sessionID
  if (typeof meta.session_id === 'string') return meta.session_id
  if (typeof meta.subSessionId === 'string') return meta.subSessionId
  if (typeof meta.subSessionID === 'string') return meta.subSessionID
  if (typeof meta.sub_session_id === 'string') return meta.sub_session_id
  const session = asRecord(meta.session)
  if (session && typeof session.id === 'string') return session.id
  return undefined
}

function getSubagentName(part: ToolPart): string | undefined {
  if (part.tool !== 'task') return undefined
  const input = getToolInput(part)
  if (!input) return undefined
  if (typeof input.subagent_type === 'string') return input.subagent_type
  if (typeof input.agent === 'string') return input.agent
  return undefined
}

function getTaskDescription(part: ToolPart): string | undefined {
  if (part.tool !== 'task') return undefined
  const input = getToolInput(part)
  if (!input) return undefined
  if (typeof input.description === 'string' && input.description.trim() !== '')
    return input.description
  return undefined
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

type Turn = { user: Message; assistants: Message[] }

const FILE_MODIFYING_TOOLS = new Set(['edit', 'write', 'delete'])

function groupTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn | undefined
  messages.forEach((m) => {
    if (m.role === 'user') {
      current = { user: m, assistants: [] }
      turns.push(current)
      return
    }
    if (m.role === 'assistant' && current) current.assistants.push(m)
  })
  return turns
}

function countFileModifications(timeline: Part[]): number {
  const modifiedFiles = new Set<string>()
  for (const p of timeline) {
    if (isPatchPart(p)) {
      for (const file of p.files) modifiedFiles.add(file)
      continue
    }
    if (!isToolPart(p)) continue
    if (!FILE_MODIFYING_TOOLS.has(p.tool)) continue
    if (p.state.status !== 'completed') continue
    const input = getToolInput(p)
    if (!input) continue
    const filePath = String(input.filePath || input.file_path || input.path || input.file || '')
    if (filePath) modifiedFiles.add(filePath)
  }
  return modifiedFiles.size
}

type TodoItem = { id?: string; content?: string; status?: string }

// Error type for API responses
type ApiErrorInfo = {
  code?: string
  data?: { code?: string; message?: string }
  message?: string
  name?: string
}

// Extract error from message (messages may have error or info.error)
function getMessageError(m: Message): ApiErrorInfo | undefined {
  const record = m as Record<string, unknown>
  const error = asRecord(record.error)
  if (error) return error as ApiErrorInfo
  const info = asRecord(record.info)
  if (info) {
    const infoError = asRecord(info.error)
    if (infoError) return infoError as ApiErrorInfo
  }
  return undefined
}

// Extract diffs from message summary
function getMessageDiffs(m: Message): FileDiff[] | undefined {
  const summary = asRecord(m.summary)
  if (!summary) return undefined
  if (Array.isArray(summary.diffs)) return summary.diffs as FileDiff[]
  return undefined
}

function getTodosFromToolPart(part: ToolPart): TodoItem[] {
  const input = getToolInput(part)
  if (input && Array.isArray(input.todos)) {
    return input.todos as TodoItem[]
  }
  if (part.state.status !== 'completed') return []
  try {
    const val =
      typeof part.state.output === 'string' ? JSON.parse(part.state.output) : part.state.output
    if (Array.isArray(val)) return val as TodoItem[]
    return []
  } catch {
    return []
  }
}

function PermissionPrompt({
  permission,
  onRespond,
  responding,
  error,
}: {
  permission: Permission
  onRespond: (response: PermissionResponse) => void
  responding: boolean
  error?: string
}) {
  return (
    <div className="rounded-lg border overflow-hidden bg-muted/30">
      <div className="flex items-center gap-2 px-3 h-8 border-b">
        <AlertCircle className="size-3 text-primary shrink-0" />
        <span className="text-xs font-medium">Permission required</span>
      </div>
      <div className="px-3 py-2 text-[11px] text-muted-foreground break-normal [overflow-wrap:break-word]">
        {permission.title}
      </div>
      <div className="flex items-stretch h-8 border-t bg-muted/40">
        <button
          onClick={() => onRespond('once')}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-primary font-medium bg-background hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {responding && <Loader2 className="size-3 animate-spin" />}
          Allow
        </button>
        <button
          onClick={() => onRespond('always')}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs border-l bg-background hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <span className="size-1.5 rounded-full bg-success" />
          Always Allow
        </button>
        <button
          onClick={() => onRespond('reject')}
          disabled={responding}
          className="flex-1 flex items-center justify-center text-xs text-muted-foreground border-l hover:bg-muted/50 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>
      {error && <div className="px-3 py-1.5 text-[11px] text-destructive border-t">{error}</div>}
    </div>
  )
}

function Tool({
  part,
  projectId,
  permission,
  onRespondPermission,
  responding,
  respondError,
  defaultExpanded,
  compact,
}: {
  part: ToolPart
  projectId?: string
  permission?: Permission
  onRespondPermission?: (permission: Permission, response: PermissionResponse) => void
  responding?: boolean
  respondError?: string
  defaultExpanded?: boolean
  compact?: boolean
}) {
  const cfg = getToolConfig(part.tool)
  const Icon = cfg.icon
  const target = getTarget(part)
  const subagentName = getSubagentName(part)
  const taskDescription = getTaskDescription(part)
  const taskRunning = part.state.status === 'running' || part.state.status === 'pending'
  const meta = part.state.status === 'pending' ? undefined : part.state.metadata
  const input = part.state.status === 'pending' ? undefined : part.state.input
  const nextSubSessionId =
    part.tool === 'task'
      ? getSessionId(meta) || getSessionId(part.metadata) || getSessionId(input)
      : undefined
  const [subSessionId, setSubSessionId] = useState(nextSubSessionId)
  const isSubagentTask = part.tool === 'task'
  const [subWorking, setSubWorking] = useState<boolean | undefined>(undefined)
  const [subDiffCount, setSubDiffCount] = useState<number | undefined>(undefined)
  const openChangesTab = useSandbox((s) => s.openChangesTab)
  const running = isSubagentTask ? (subWorking ?? taskRunning) : taskRunning
  const compactMode = compact === true

  // Track expanded state - auto-expand when running
  const [expanded, setExpanded] = useState(defaultExpanded ?? true)
  const [wasRunning, setWasRunning] = useState(running)
  const isExpanded = compactMode ? false : expanded

  // Subagent tasks: auto-expand when running, auto-collapse when done
  useEffect(() => {
    if (isSubagentTask) {
      const isRunning = subWorking ?? taskRunning
      if (!wasRunning && isRunning) setExpanded(true)
      if (wasRunning && !isRunning) setExpanded(false)
      setWasRunning(isRunning)
      return
    }
    if (wasRunning && !running) setExpanded(false)
    setWasRunning(running)
  }, [isSubagentTask, running, subWorking, taskRunning, wasRunning])

  useEffect(() => {
    if (!nextSubSessionId || nextSubSessionId === subSessionId) return
    setSubSessionId(nextSubSessionId)
    setSubWorking(undefined)
    setSubDiffCount(undefined)
  }, [nextSubSessionId, subSessionId])

  // Subagent tasks with sliding window view
  if (isSubagentTask && projectId) {
    return (
      <div className={permission ? 'space-y-2' : undefined}>
        {/* Header */}
        <button
          onClick={() => setExpanded((s) => !s)}
          className="group flex items-center gap-2 w-full text-left py-1"
        >
          {running ? (
            <span className="size-2 rounded-full bg-brand animate-pulse shrink-0" />
          ) : (
            <CheckCircle weight="fill" className="size-3.5 text-brand shrink-0" />
          )}
          <span className="text-sm truncate">
            {running ? (
              <span className="text-foreground">
                {taskDescription || target || 'Sub-assistant'}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {taskDescription || target || 'Sub-assistant'}
              </span>
            )}
            {subagentName && (
              <>
                <span className="text-muted-foreground/50"> · </span>
                {running ? (
                  <ShimmeringText
                    text={`@${subagentName}`}
                    duration={0.6}
                    className="text-brand/80"
                  />
                ) : (
                  <span className="text-muted-foreground/50">@{subagentName}</span>
                )}
              </>
            )}
          </span>
          {!running && subDiffCount !== undefined && subDiffCount > 0 && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                openChangesTab?.(undefined, subSessionId)
              }}
              className="ml-2 text-[10px] text-muted-foreground/70 hover:text-foreground bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded-full cursor-pointer transition-colors"
            >
              {subDiffCount} file{subDiffCount !== 1 ? 's' : ''} changed
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground/50 group-hover:text-muted-foreground">
            {expanded ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {/* Sliding window content */}
        {subSessionId && (
          <div className={expanded ? 'block' : 'hidden'}>
            <SubagentStream
              projectId={projectId}
              sessionId={subSessionId}
              onWorkingChange={setSubWorking}
              onDiffCountChange={setSubDiffCount}
            />
          </div>
        )}
        {expanded && !subSessionId && running && (
          <div className="text-sm text-muted-foreground/50 py-2 pl-4">Starting...</div>
        )}

        {permission && onRespondPermission && (
          <PermissionPrompt
            permission={permission}
            onRespond={(response) => onRespondPermission(permission, response)}
            responding={responding === true}
            error={respondError}
          />
        )}
      </div>
    )
  }

  const header = (() => {
    if (running) {
      return (
        <div className="flex items-center gap-1 sm:gap-1.5 py-0.5 sm:py-1 text-[11px] sm:text-sm text-muted-foreground flex-wrap min-w-0">
          {cfg.doing ? (
            <ShimmeringText text={cfg.doing} duration={0.4} className="text-[11px] sm:text-sm" />
          ) : (
            <FunWorkingText className="text-[11px] sm:text-sm" />
          )}
          {target && (
            <code className="px-1 py-0.5 bg-muted rounded text-[10px] sm:text-xs truncate max-w-24 sm:max-w-48">
              {target}
            </code>
          )}
        </div>
      )
    }

    if (part.state.status === 'error') {
      return (
        <div className="flex items-center gap-1 py-0.5 text-[11px] sm:text-xs text-muted-foreground/60">
          <Icon className="size-2.5 sm:size-3 shrink-0" />
          <span>Skipped {target || cfg.done}</span>
        </div>
      )
    }

    return (
      <div className="group flex items-center gap-1 py-0.5 sm:py-1 text-[11px] sm:text-sm text-muted-foreground flex-wrap min-w-0">
        <Icon className={`size-2.5 sm:size-3.5 shrink-0 ${isExpanded ? 'text-foreground' : ''}`} />
        <span>{cfg.done}</span>
        {target && (
          <code className="px-1 py-0.5 bg-muted rounded text-[10px] sm:text-xs truncate max-w-24 sm:max-w-48">
            {target}
          </code>
        )}
        {!compactMode && (
          <span
            className={`text-[10px] transition-opacity ${isExpanded ? 'opacity-60' : 'opacity-0 group-hover:opacity-60'}`}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
      </div>
    )
  })()

  if (compactMode) {
    return (
      <div className={permission ? 'space-y-2' : undefined}>
        {header}
        {permission && onRespondPermission && (
          <PermissionPrompt
            permission={permission}
            onRespond={(response) => onRespondPermission(permission, response)}
            responding={responding === true}
            error={respondError}
          />
        )}
      </div>
    )
  }

  return (
    <div className={permission ? 'space-y-2' : undefined}>
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full text-left hover:text-foreground cursor-pointer transition-colors"
      >
        {header}
      </button>

      {expanded && (
        <div className="ml-3 sm:ml-4 pl-2 sm:pl-3 border-l-2 border-muted space-y-2 text-[11px] sm:text-xs">
          {part.tool !== 'task' && part.state.status !== 'pending' && (
            <div>
              <div className="text-muted-foreground/70 font-medium mb-1">Input</div>
              <pre className="p-2 rounded bg-muted/50 whitespace-pre-wrap break-normal [overflow-wrap:break-word]">
                {formatValue(part.state.input)}
              </pre>
            </div>
          )}
          {part.tool !== 'task' && part.state.status === 'completed' && (
            <div>
              <div className="text-muted-foreground/70 font-medium mb-1">Output</div>
              <pre className="p-2 rounded bg-muted/50 whitespace-pre-wrap break-normal [overflow-wrap:break-word]">
                {formatValue(part.state.output)}
              </pre>
            </div>
          )}
          {part.tool !== 'task' && part.state.status === 'error' && (
            <div>
              <div className="text-destructive/70 font-medium mb-1">Error</div>
              <pre className="p-2 rounded bg-destructive/10 whitespace-pre-wrap break-normal [overflow-wrap:break-word] text-destructive">
                {String(part.state.error)}
              </pre>
            </div>
          )}
        </div>
      )}

      {permission && onRespondPermission && (
        <PermissionPrompt
          permission={permission}
          onRespond={(response) => onRespondPermission(permission, response)}
          responding={responding === true}
          error={respondError}
        />
      )}
    </div>
  )
}

function SubagentStream({
  projectId,
  sessionId,
  onWorkingChange,
  onDiffCountChange,
}: {
  projectId: string
  sessionId: string
  onWorkingChange?: (working: boolean) => void
  onDiffCountChange?: (count: number) => void
}) {
  const { messages, parts, permissions, status, loading, connected, lastAt } = useAgentStream({
    projectId,
    sessionId,
  })
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickRef = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [diffCount, setDiffCount] = useState<number | undefined>(undefined)
  const working = useMemo(() => {
    if (status?.type) return status.type !== 'idle'
    const timeline = messages.flatMap((m) => parts[m.id] || [])
    return computeWorkingFromParts(timeline)
  }, [status, messages, parts])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      const nearBottom = distance < 80
      stickRef.current = nearBottom
      setShowJump(!nearBottom)
    }
    el.addEventListener('scroll', onScroll)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!stickRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
    setShowJump((value) => (value ? false : value))
  }, [lastAt])

  useEffect(() => {
    onWorkingChange?.(working)
  }, [onWorkingChange, working])

  useEffect(() => {
    if (working) {
      if (diffCount !== undefined) setDiffCount(undefined)
      return
    }
    if (messages.length === 0) return
    const timeline = messages.flatMap((m) => parts[m.id] || [])
    const next = countFileModifications(timeline)
    if (next === diffCount) return
    setDiffCount(next)
    onDiffCountChange?.(next)
  }, [working, messages, parts, diffCount, onDiffCountChange])

  if (messages.length === 0) {
    return (
      <div className="pl-4 border-l-2 border-border/40 text-sm text-muted-foreground/50 py-1">
        {!connected ? (
          'Connecting...'
        ) : loading ? (
          'Loading...'
        ) : (
          <FunWorkingText className="text-sm" />
        )}
      </div>
    )
  }

  return (
    <div className="relative pl-4 border-l-2 border-border/40">
      <div ref={scrollRef} className="max-h-96 overflow-y-auto pr-2">
        <AgentThread
          projectId={projectId}
          sessionId={sessionId}
          messages={messages}
          partsMap={parts}
          permissions={permissions}
          isWorking={working}
          thoughtsStyle="inline"
          thoughtsDefaultOpen
          showActions={false}
          toolDefaultExpanded={false}
          toolMode="compact"
        />
      </div>
      {showJump && (
        <button
          onClick={() => {
            const el = scrollRef.current
            if (!el) return
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            stickRef.current = true
            setShowJump(false)
          }}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/80 shadow-sm"
        >
          <ArrowDown className="size-3" />
          Latest
        </button>
      )}
    </div>
  )
}

function Todos({ part }: { part: ToolPart }) {
  const loading = part.state.status === 'running' || part.state.status === 'pending'
  const todos = useMemo(() => getTodosFromToolPart(part), [part.state])

  const done = todos.filter((t) => t.status === 'completed').length

  return (
    <div className="my-1.5 sm:my-2 p-2 sm:p-3 rounded-xl bg-muted/50 border w-full min-w-0">
      <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">
        <ListTodo className="size-3 sm:size-4 shrink-0" />
        <span className="font-medium">
          {done}/{todos.length} done
        </span>
        {loading && <Loader2 className="size-2.5 sm:size-3 animate-spin ml-1" />}
      </div>
      {todos.length > 0 ? (
        <div className="space-y-1 sm:space-y-1.5">
          {todos.map((t, i) => {
            const isDone = t.status === 'completed'
            return (
              <div
                key={t.id || i}
                className={`flex items-start gap-1 sm:gap-2 text-[11px] sm:text-sm ${isDone ? 'opacity-50' : ''}`}
              >
                <div
                  className={`size-3 sm:size-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${isDone ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}
                >
                  {isDone && (
                    <CheckCircle2 className="size-1.5 sm:size-2.5 text-primary-foreground" />
                  )}
                </div>
                <span
                  className={`break-normal [overflow-wrap:break-word] min-w-0 ${isDone ? 'line-through text-muted-foreground' : ''}`}
                >
                  {t.content}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[11px] sm:text-xs text-muted-foreground">No tasks yet</p>
      )}
    </div>
  )
}

function SubagentThought({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className="py-0.5 text-[11px] sm:text-sm text-muted-foreground">
      {text ? (
        <Markdown className="prose prose-sm max-w-none prose-muted **:text-[11px] sm:**:text-sm">
          {text}
        </Markdown>
      ) : streaming ? (
        <ShimmeringText text="Thinking..." duration={0.3} />
      ) : null}
    </div>
  )
}

function Thinking({
  text,
  streaming,
  open,
  toggle,
}: {
  text: string
  streaming: boolean
  open: boolean
  toggle: () => void
}) {
  return (
    <div className="my-1">
      <button
        onClick={toggle}
        className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className={`font-medium ${open ? 'text-foreground' : ''}`}>
          {streaming ? 'Thinking...' : 'Thoughts'}
        </span>
        {!streaming && <span className="text-[10px] opacity-60">{open ? '▾' : '▸'}</span>}
      </button>
      {open && (
        <div className="pl-2 sm:pl-5 pt-1 sm:pt-1.5 text-[11px] sm:text-sm text-muted-foreground border-l-2 border-muted ml-1 sm:ml-1.5 min-w-0">
          {text ? (
            <Markdown className="prose prose-sm max-w-none prose-muted **:text-[11px] sm:**:text-sm">
              {text}
            </Markdown>
          ) : streaming ? (
            <ShimmeringText text="Thinking..." duration={0.3} />
          ) : null}
        </div>
      )}
    </div>
  )
}

function FileThumb({ file }: { file: FilePart }) {
  const isImage = file.mime?.startsWith('image/')
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      download={!isImage ? file.filename : undefined}
      className="block size-8 sm:size-10 rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity shrink-0"
    >
      {isImage ? (
        <img src={file.url} alt={file.filename || 'file'} className="size-full object-cover" />
      ) : (
        <div className="size-full flex items-center justify-center">
          <FileText className="size-3 sm:size-4 text-muted-foreground" />
        </div>
      )}
    </a>
  )
}

function ApiError({ error }: { error: ApiErrorInfo }) {
  const code = error?.code || error?.data?.code
  const msg = error?.data?.message || error?.message || error?.name || 'Request failed'
  const isContext = code === 'context_length_exceeded' || msg.includes('context')

  return (
    <div
      className={`flex items-start gap-2 py-2 px-3 rounded-lg border text-xs sm:text-sm ${isContext ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-muted/50 text-muted-foreground'}`}
    >
      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
      <p className="min-w-0 break-normal [overflow-wrap:break-word]">
        {isContext ? 'Context limit reached. Start a new session.' : msg}
      </p>
    </div>
  )
}

export function AgentThread({
  projectId,
  sessionId,
  messages,
  partsMap,
  permissions,
  isWorking,
  onRevert,
  thoughtsStyle = 'toggle',
  thoughtsDefaultOpen = false,
  showActions = true,
  toolDefaultExpanded = false,
  toolMode = 'full',
}: {
  projectId?: string
  sessionId: string
  messages: Message[]
  partsMap: Record<string, Part[]>
  permissions?: Permission[]
  isWorking?: boolean
  onRevert?: (messageId: string) => void
  thoughtsStyle?: 'toggle' | 'inline'
  thoughtsDefaultOpen?: boolean
  showActions?: boolean
  toolDefaultExpanded?: boolean
  toolMode?: 'full' | 'compact'
}) {
  const [openThoughts, setOpenThoughts] = useState<Record<string, boolean>>({})
  const [permissionErrors, setPermissionErrors] = useState<Record<string, string>>({})
  const respondPermission = useRespondPermission(projectId, sessionId)

  const turns = useMemo(() => groupTurns(messages), [messages])

  const permissionByCallId = useMemo(() => {
    const map = new Map<string, Permission>()
    ;(permissions ?? []).forEach((p) => {
      if (p.callID) map.set(p.callID, p)
    })
    return map
  }, [permissions])

  const toolCallIds = useMemo(() => {
    const ids = new Set<string>()
    messages.forEach((m) => {
      ;(partsMap[m.id] ?? []).forEach((p) => {
        if (!isToolPart(p)) return
        if (p.tool === 'todoread') return
        if (p.callID) ids.add(p.callID)
      })
    })
    return ids
  }, [partsMap, messages])

  const unmatchedPermissions = useMemo(() => {
    if (!permissions?.length) return []
    return permissions.filter((p) => !p.callID || !toolCallIds.has(p.callID))
  }, [permissions, toolCallIds])

  const respondToPermission = (permission: Permission, response: PermissionResponse) => {
    if (!projectId) return
    setPermissionErrors((s) => {
      if (!s[permission.id]) return s
      const { [permission.id]: _, ...rest } = s
      return rest
    })
    respondPermission.mutate(
      { permissionId: permission.id, response },
      {
        onError: (err) => {
          setPermissionErrors((s) => ({
            ...s,
            [permission.id]: err instanceof Error ? err.message : String(err),
          }))
        },
      },
    )
  }

  const getText = (m: Message) => {
    const fromParts = (partsMap[m.id] ?? [])
      .filter(isTextPart)
      .filter((p) => !p.synthetic && !p.ignored)
      .map((p) => p.text)
      .join('\n')
    const summary = m.summary
    const fromSummary =
      summary && typeof summary === 'object' ? summary.body || summary.title || '' : ''
    const text = fromParts || fromSummary
    if (m.role === 'user') {
      return text.replace(/!\[[^\]]*\]\([^)]+\)\n*/g, '').trim()
    }
    return text
  }

  const getFiles = (m: Message) => partsMap[m.id]?.filter(isFilePart) ?? []

  const renderPart = (p: Part) => {
    if (p.type === 'subtask') {
      const description = p.description ? ` — ${p.description}` : ''
      return (
        <div
          key={p.id}
          className="my-1.5 sm:my-2 px-3 py-2 rounded-lg border bg-muted/30 text-[11px] sm:text-xs text-muted-foreground"
        >
          <span className="font-medium text-foreground">Subagent requested</span>{' '}
          <code className="px-1 py-0.5 bg-muted rounded text-[10px] sm:text-xs">@{p.agent}</code>
          {description}
        </div>
      )
    }

    if (isReasoningPart(p)) {
      const text = p.text?.replace('[REDACTED]', '').trim() || ''
      const streaming = !p.time?.end
      if (!text && !streaming) return null
      if (thoughtsStyle === 'inline')
        return <SubagentThought key={p.id} text={text} streaming={streaming} />
      return (
        <Thinking
          key={p.id}
          text={text}
          streaming={streaming}
          open={openThoughts[p.id] ?? (thoughtsDefaultOpen ? true : streaming)}
          toggle={() => setOpenThoughts((s) => ({ ...s, [p.id]: !s[p.id] }))}
        />
      )
    }

    if (isToolPart(p)) {
      const permission = p.callID ? permissionByCallId.get(p.callID) : undefined
      if (p.tool === 'todoread') return null
      if (p.tool === 'todowrite') {
        if (!permission) return <Todos key={p.id} part={p} />
        return (
          <div key={p.id} className="space-y-2">
            <Todos part={p} />
            <PermissionPrompt
              permission={permission}
              onRespond={(response) => respondToPermission(permission, response)}
              responding={
                respondPermission.isPending &&
                respondPermission.variables?.permissionId === permission.id
              }
              error={permissionErrors[permission.id]}
            />
          </div>
        )
      }
      return (
        <Tool
          key={p.id}
          part={p}
          projectId={projectId}
          permission={permission}
          onRespondPermission={respondToPermission}
          responding={
            respondPermission.isPending &&
            respondPermission.variables?.permissionId === permission?.id
          }
          respondError={permission ? permissionErrors[permission.id] : undefined}
          defaultExpanded={toolDefaultExpanded}
          compact={toolMode === 'compact'}
        />
      )
    }

    if (isFilePart(p)) {
      return (
        <div key={p.id} className="flex gap-1 py-1">
          <FileThumb file={p} />
        </div>
      )
    }

    // Hide step markers - these are internal and noisy
    if (p.type === 'step-start' || p.type === 'step-finish' || isPatchPart(p)) {
      return null
    }

    if (isTextPart(p)) {
      const content = p.text?.trim()
      if (!content) return null
      return (
        <Markdown
          key={p.id}
          className="[&_p]:text-[13px] [&_p]:sm:text-sm [&_li]:text-[13px] [&_li]:sm:text-sm"
        >
          {content}
        </Markdown>
      )
    }

    return null
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {turns.map((turn, idx) => {
        const timeline = turn.assistants.flatMap((m) => partsMap[m.id] || [])
        const messageDiffs = getMessageDiffs(turn.user)
        const fileModCount = messageDiffs?.length ?? countFileModifications(timeline)
        const lastAssistantId = turn.assistants[turn.assistants.length - 1]?.id
        const toolWorking = timeline.some((p) => {
          if (!isToolPart(p)) return false
          return p.state.status === 'running' || p.state.status === 'pending'
        })

        const text = getText(turn.user)
        const userFiles = getFiles(turn.user)
        const userParts = partsMap[turn.user.id] ?? []
        const isSyntheticUser = userParts.some((p) => isTextPart(p) && p.synthetic)
        const isLast = idx === turns.length - 1
        const lastAssistant = turn.assistants[turn.assistants.length - 1]
        const assistantDone = !isLast
          ? true
          : lastAssistant?.time
            ? 'completed' in lastAssistant.time
              ? !!lastAssistant.time.completed
              : false
            : false
        const working = isLast
          ? (isWorking ??
            !!(
              lastAssistant &&
              lastAssistant.role === 'assistant' &&
              !lastAssistant.time.completed
            ))
          : false
        const showPlanning = isLast && !!working && !toolWorking
        const showSending = isLast && userParts.length === 0 && !text && userFiles.length === 0
        const showUser = !isSyntheticUser && (userFiles.length > 0 || !!text || showSending)
        const showActionsRow =
          showActions &&
          assistantDone &&
          !showSending &&
          (fileModCount > 0 || onRevert) &&
          lastAssistantId

        return (
          <div key={turn.user.id} className="space-y-2 sm:space-y-3">
            {showUser && (
              <div className="flex flex-col items-end gap-1">
                {userFiles.length > 0 && (
                  <div className="flex gap-1 flex-wrap justify-end">
                    {userFiles.map((fp) => (
                      <FileThumb key={fp.id} file={fp} />
                    ))}
                  </div>
                )}
                <div className="relative max-w-[90%] sm:max-w-[80%] md:max-w-[70%] rounded-xl bg-muted/50 border px-2.5 sm:px-3 py-2 overflow-hidden">
                  <div className="whitespace-pre-wrap text-sm sm:text-[15px] break-normal [overflow-wrap:break-word]">
                    {text ? (
                      text
                    ) : showSending ? (
                      <span className="text-muted-foreground italic">Sending...</span>
                    ) : userFiles.length ? (
                      <span className="text-muted-foreground italic">Sent attachment</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {turn.assistants.map((m) => {
                const err = getMessageError(m)
                if (!err) return null
                const msg = err.data?.message || err.message || err.name || 'Request failed'
                if (msg.toLowerCase().includes('abort')) return null
                return <ApiError key={m.id} error={err} />
              })}

              {timeline.map(renderPart)}

              {isLast &&
                unmatchedPermissions.map((permission) => (
                  <PermissionPrompt
                    key={permission.id}
                    permission={permission}
                    onRespond={(response) => respondToPermission(permission, response)}
                    responding={
                      respondPermission.isPending &&
                      respondPermission.variables?.permissionId === permission.id
                    }
                    error={permissionErrors[permission.id]}
                  />
                ))}

              {showPlanning && (
                <FunWorkingText className="text-xs sm:text-sm text-muted-foreground py-1" />
              )}

              {/* Actions row: diff badge + undo */}
              {!working && showActionsRow && (
                <div className="flex items-center gap-2 pt-2">
                  {fileModCount > 0 && (
                    <MessageDiffBadge
                      messageId={turn.user.id}
                      sessionId={turn.user.sessionID}
                      diffs={messageDiffs}
                      fileCount={fileModCount}
                    />
                  )}
                  {onRevert && (
                    <button
                      onClick={() => onRevert(turn.user.id)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      title="Undo this message and revert file changes"
                    >
                      <Undo2 className="size-3" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
