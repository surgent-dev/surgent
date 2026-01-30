'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { http } from '@/lib/http'
import {
  MessageCircle,
  Loader2,
  MessagesSquare,
  Terminal,
  Plus,
  History,
  Check,
  AlertCircle,
  X,
  RefreshCw,
  Redo2,
  GitCompare,
  ArrowDown,
} from 'lucide-react'
import { Chat, ArrowElbowDownRight } from '@phosphor-icons/react'
import ChatInput, { type FilePart, type ProviderModel } from './chat-input'
import TerminalWidget from './terminal/terminal-widget'
import { useSandbox } from '@/hooks/use-sandbox'
import useAgentStream, { type SessionStatusRetry } from '@/lib/use-agent-stream'
import { computeWorkingFromParts } from '@/lib/agent-working'
import { AgentThread } from '@/components/agent/agent-thread'
import QuestionPrompt from '@/components/agent/question-prompt'
import {
  useSessionsQuery,
  useCreateSession,
  useSendMessage,
  useAbortSession,
  useRevertSession,
  useUnrevertSession,
  useReplyQuestion,
  useRejectQuestion,
  useSubagents,
} from '@/queries/chats'
import ProviderDialog from '@/components/provider-dialog'

export interface ConversationProps {
  projectId?: string
  initialPrompt?: string
}

type ProviderResponse = {
  all: Array<{
    id: string
    name?: string
    models: Record<string, { id?: string; name?: string; limit?: { context?: number } }>
  }>
  default?: Record<string, string>
}

const FALLBACK_MODELS: ProviderModel[] = [
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 400000 },
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 200000 },
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 1048576 },
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    providerId: 'opencode',
    providerName: 'OpenCode',
    limit: { context: 1048576 },
  },
]

const formatTitle = (title: string) => {
  const isoMatch = title.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  if (!isoMatch) return title
  try {
    return format(parseISO(isoMatch[0]), 'MMM d HH:mm')
  } catch {
    return title
  }
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2.5 text-sm border-r transition-colors shrink-0 @md/conversation:gap-2 @md/conversation:px-4',
        active ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  )
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 px-2.5 text-sm border-l transition-colors shrink-0 @md/conversation:gap-2 @md/conversation:px-4',
        disabled ? 'opacity-50 cursor-not-allowed' : 'text-muted-foreground hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  )
}

function RetryCountdown({ retryInfo }: { retryInfo: SessionStatusRetry }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((retryInfo.next - Date.now()) / 1000)),
  )

  useEffect(() => {
    const updateRemaining = () => {
      const diff = Math.max(0, Math.ceil((retryInfo.next - Date.now()) / 1000))
      setRemaining(diff)
    }
    updateRemaining()
    const interval = setInterval(updateRemaining, 1000)
    return () => clearInterval(interval)
  }, [retryInfo.next])

  return (
    <div className="flex items-center gap-1.5 text-xs text-warning">
      <RefreshCw className="size-3 animate-spin" />
      <span>Retry #{retryInfo.attempt}</span>
      <span className="text-muted-foreground">·</span>
      <span className="tabular-nums">{remaining}s</span>
    </div>
  )
}

function EmptyState({
  title = 'No messages yet',
  description = 'Start a conversation',
  icon: Icon = MessageCircle,
}: {
  title?: string
  description?: string
  icon?: ElementType
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] text-center px-4">
      <div className="rounded-full bg-muted p-3 sm:p-4 mb-3 sm:mb-4">
        <Icon className="size-6 sm:size-8 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="font-medium text-sm sm:text-base">{title}</p>
      <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default function Conversation({ projectId, initialPrompt }: ConversationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const usageRef = useRef<{
    ctxTokens?: number
    contextPct?: number
    costSpent: number
    contextExceeded?: boolean
  } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement | null>(null)
  const shouldStickRef = useRef(true)
  const rafRef = useRef(0)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const prefilledRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const showTerminal = searchParams?.get('terminal') === 'true'
  const [tab, setTab] = useState<'chat' | 'terminal'>('chat')
  const [mode, setMode] = useState<'plan' | 'orchestrator'>('orchestrator')
  const [providerOpen, setProviderOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [selectedModel, setSelectedModel] = useState<
    { modelId: string; providerId: string } | undefined
  >(undefined)
  const lastSentRef = useRef<string>('')

  const sandboxId = useSandbox((s) => s.sandboxId || undefined)
  const storedSessionId = useSandbox((s) => (projectId ? s.activeSessionId[projectId] : undefined))
  const setActiveSession = useSandbox((s) => s.setActiveSession)
  const openChangesTab = useSandbox((s) => s.openChangesTab)

  const { data: sessions = [] } = useSessionsQuery(projectId)
  const { data: subagents = [] } = useSubagents(projectId)
  const create = useCreateSession(projectId)
  const send = useSendMessage(projectId)
  const abort = useAbortSession()
  const revert = useRevertSession(projectId)
  const unrevert = useUnrevertSession(projectId)
  const replyQuestion = useReplyQuestion(projectId)
  const rejectQuestion = useRejectQuestion(projectId)

  const activeId =
    storedSessionId && sessions.some((s) => s.id === storedSessionId)
      ? storedSessionId
      : sessions[0]?.id
  const {
    messages,
    parts,
    permissions,
    questions,
    session,
    connected,
    status,
    loading,
    compacting,
    error: sessionError,
    dismissError,
    isRetrying,
    retryInfo,
  } = useAgentStream({ projectId, sessionId: activeId })

  const working = useMemo(() => {
    if (status?.type) return status.type !== 'idle'
    const timeline = messages.flatMap((m) => parts[m.id] || [])
    return computeWorkingFromParts(timeline)
  }, [status, messages, parts])

  useEffect(() => {
    if (!projectId || !activeId) return
    if (storedSessionId === activeId) return
    setActiveSession(projectId, activeId)
  }, [activeId, projectId, setActiveSession, storedSessionId])

  // Debounced scroll-to-bottom function
  const scrollToBottom = useCallback((force = false) => {
    const viewport = viewportRef.current
    if (!viewport) return

    // Debounce rapid calls during streaming
    clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (force || shouldStickRef.current) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: force ? 'smooth' : 'instant' })
          shouldStickRef.current = true
          setShowScrollButton(false)
        }
      })
    }, 16) // ~1 frame debounce
  }, [])

  // Auto-scroll: observe content size changes for reliable streaming updates
  useEffect(() => {
    const container = scrollRef.current
    const content = contentRef.current
    if (!container || !content) return

    const viewport = container.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
    if (!viewport) return
    viewportRef.current = viewport

    const triggerScroll = () => scrollToBottom()

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = viewport
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const isNearBottom = distanceFromBottom < 80

      shouldStickRef.current = isNearBottom
      setShowScrollButton(!isNearBottom && scrollHeight > clientHeight)
    }

    // ResizeObserver triggers on any content size change (including streaming)
    const resizeObserver = new ResizeObserver(triggerScroll)
    resizeObserver.observe(content)

    // MutationObserver as fallback for DOM changes ResizeObserver might miss
    const mutationObserver = new MutationObserver(triggerScroll)
    mutationObserver.observe(content, { childList: true, subtree: true, characterData: true })

    viewport.addEventListener('scroll', handleScroll, { passive: true })

    // Initial scroll to bottom after mount
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
      shouldStickRef.current = true
      setShowScrollButton(false)
    })

    return () => {
      clearTimeout(scrollTimeoutRef.current)
      cancelAnimationFrame(rafRef.current)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [activeId, scrollToBottom])

  // Prefill initial prompt into input
  useEffect(() => {
    if (!initialPrompt || prefilledRef.current) return
    const text = initialPrompt.trim()
    if (!text) return

    prefilledRef.current = true
    if (!inputValue) setInputValue(text)

    // Clean up URL param
    try {
      const params = new URLSearchParams(searchParams?.toString?.() || '')
      if (params.has('initial')) {
        params.delete('initial')
        router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false })
      }
    } catch {}
  }, [initialPrompt, inputValue, pathname, router, searchParams])

  const handleSend = (
    text: string,
    files?: FilePart[],
    model?: string,
    providerID?: string,
    variant?: string,
  ) => {
    if (!activeId || (!text.trim() && !files?.length) || working) return
    lastSentRef.current = text.trim()
    setInputValue('')
    send.mutate({
      sessionId: activeId,
      text: text.trim(),
      agent: mode,
      files,
      model,
      providerID,
      variant,
    })
  }

  const handleAbort = () => {
    if (!activeId || !projectId) return
    abort.mutate({ projectId, sessionId: activeId })
    // Restore the last sent message back to the input
    if (lastSentRef.current) {
      setInputValue(lastSentRef.current)
      lastSentRef.current = ''
    }
  }

  const handleRevert = (messageId: string) => {
    if (!activeId) return
    revert.mutate({ sessionId: activeId, messageId })
  }

  const handleUnrevert = () => {
    if (!activeId) return
    unrevert.mutate({ sessionId: activeId })
  }

  // Filter out reverted messages (>= revert point)
  const revertMessageId = session?.revert?.messageID
  const visibleMessages = useMemo(
    () => (revertMessageId ? messages.filter((m) => m.id < revertMessageId) : messages),
    [messages, revertMessageId],
  )

  const handleCreate = () =>
    create.mutateAsync().then((s) => s?.id && projectId && setActiveSession(projectId, s.id))

  const activeSession = sessions.find((s) => s.id === activeId)
  const sessionName = formatTitle(session?.title || activeSession?.title || 'Untitled')

  // Group sessions by parent
  const sessionTree = useMemo(() => {
    const children = new Map<string, typeof sessions>()
    const roots: typeof sessions = []

    for (const s of sessions) {
      const pid = (s as any).parentID
      pid ? children.set(pid, [...(children.get(pid) || []), s]) : roots.push(s)
    }

    return roots.map((s) => ({ ...s, subs: children.get(s.id) || [] }))
  }, [sessions])

  const assistantMessages = visibleMessages.filter((m) => m.role === 'assistant')

  const isContextLengthExceeded = (err: any) => {
    if (!err) return false
    const directCode = err.code || err.data?.code
    if (directCode === 'context_length_exceeded') return true

    const responseBody = err.data?.responseBody ?? err.responseBody
    if (typeof responseBody === 'string' && responseBody) {
      try {
        const body = JSON.parse(responseBody)
        const code =
          body?.code ??
          body?.error?.code ??
          body?.error?.error?.code ??
          body?.error?.data?.code ??
          body?.error?.error?.data?.code
        if (code === 'context_length_exceeded') return true
        if (body?.type === 'error' && body?.error?.code === 'context_length_exceeded') return true
      } catch {}
    }

    const msg = err.data?.message || err.message || err.name
    return (
      typeof msg === 'string' &&
      (msg.toLowerCase().includes('context_length_exceeded') ||
        msg.toLowerCase().includes('context window'))
    )
  }

  const lastAssistantError = (() => {
    const last = assistantMessages[assistantMessages.length - 1]
    const err = (last as any)?.error || (last as any)?.info?.error
    if (!err) return undefined
    const code = err.code || err.data?.code
    const msg = err.data?.message || err.message || err.name
    if (msg?.toLowerCase().includes('abort')) return undefined
    const isContext =
      isContextLengthExceeded(err) || code === 'context_length_exceeded' || msg?.includes('context')
    return { message: isContext ? 'Context limit reached. Start a new session.' : msg, isContext }
  })()

  const { data: providerData } = useQuery<ProviderResponse>({
    queryKey: ['opencode-models', projectId],
    enabled: Boolean(projectId),
    staleTime: 60_000,
    queryFn: async () => http.get(`api/agent/${projectId}/provider`).json<ProviderResponse>(),
  })

  const availableModels = useMemo(() => {
    if (!providerData) return FALLBACK_MODELS
    const provider = providerData.all?.find((item) => item.id === 'opencode')
    if (!provider?.models) return []
    return FALLBACK_MODELS.filter((model) => Boolean(provider.models[model.id]))
  }, [providerData])

  const handleModelChange = (modelId: string, providerId: string) => {
    setSelectedModel({ modelId, providerId })
  }

  useEffect(() => {
    if (!availableModels.length) return
    if (selectedModel) {
      const exists = availableModels.some(
        (model) =>
          model.id === selectedModel.modelId && model.providerId === selectedModel.providerId,
      )
      if (exists) return
    }
    const fallback = availableModels[0]
    if (!fallback) return
    setSelectedModel({ modelId: fallback.id, providerId: fallback.providerId })
  }, [availableModels, selectedModel])

  // Reset state on session change
  useEffect(() => {
    usageRef.current = null
    shouldStickRef.current = true
    setShowScrollButton(false)
  }, [activeId])

  // Track context tokens from the last COMPLETED assistant message
  // During streaming, we keep showing the previous value to avoid flickering
  useEffect(() => {
    const last = assistantMessages[assistantMessages.length - 1]
    if (!last) return

    // Calculate total cost (always summing all messages)
    const currentCost = assistantMessages.reduce((sum, m) => sum + ('cost' in m ? m.cost : 0), 0)

    const tokens = 'tokens' in last ? last.tokens.input + last.tokens.cache.read : 0
    const contextExceeded =
      Boolean(lastAssistantError?.isContext) || isContextLengthExceeded(sessionError)

    if (contextExceeded) {
      usageRef.current = {
        ctxTokens: undefined,
        contextPct: undefined,
        costSpent: currentCost,
        contextExceeded: true,
      }
      return
    }

    // Only update tokens if this message has them (implies it's at least partially done)
    if (tokens > 0) {
      let pct = usageRef.current?.contextPct

      if ('providerID' in last && 'modelID' in last) {
        const limit = availableModels.find((m) => m.id === last.modelID)?.limit?.context
        if (limit) pct = Math.round((tokens / limit) * 100)
      }

      usageRef.current = {
        ctxTokens: tokens,
        contextPct: pct,
        costSpent: currentCost,
      }
    } else if (usageRef.current) {
      // Just update cost if we have a cache but no new tokens yet
      usageRef.current.costSpent = currentCost
    }
  }, [assistantMessages, availableModels, lastAssistantError?.isContext, sessionError])

  const shownTokens = usageRef.current?.ctxTokens
  const shownPct = usageRef.current?.contextPct
  const shownCost = usageRef.current?.costSpent ?? 0
  const contextExceeded = usageRef.current?.contextExceeded

  return (
    <div className="flex flex-col h-full w-full min-w-0 @container/conversation">
      {/* Header */}
      <header className="flex flex-col border-b bg-muted/30 shrink-0">
        {/* Tabs + Session + Actions */}
        <div className="flex h-10 items-stretch border-b min-w-0">
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
            <MessagesSquare className="size-4" />
            <span className="hidden @md/conversation:inline">Chat</span>
          </TabButton>
          {showTerminal && (
            <TabButton active={tab === 'terminal'} onClick={() => setTab('terminal')}>
              <Terminal className="size-4" />
              <span className="hidden @md/conversation:inline">Terminal</span>
            </TabButton>
          )}

          <div className="flex-1" />

          <ActionButton onClick={handleCreate} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            <span className="hidden @md/conversation:inline">New session</span>
          </ActionButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center px-2.5 text-sm border-l text-muted-foreground hover:bg-muted/50 @md/conversation:px-4">
                <History className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {sessionTree.map((s) => (
                <div key={s.id}>
                  <DropdownMenuItem
                    onClick={() => projectId && setActiveSession(projectId, s.id)}
                    className={cn('gap-2', s.id === activeId && 'bg-accent')}
                  >
                    <Chat weight={s.id === activeId ? 'fill' : 'regular'} className="size-4" />
                    <span className="truncate">{formatTitle(s.title || 'Untitled')}</span>
                  </DropdownMenuItem>

                  {s.subs.map((sub) => (
                    <DropdownMenuItem
                      key={sub.id}
                      onClick={() => projectId && setActiveSession(projectId, sub.id)}
                      className={cn('gap-1.5 pl-5', sub.id === activeId ? 'bg-accent' : 'text-muted-foreground')}
                    >
                      <ArrowElbowDownRight className="size-3" />
                      <span className="truncate text-xs">{formatTitle(sub.title || 'Task')}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Context stats */}
        <div className="h-8 flex items-center px-3 gap-2 min-w-0 text-xs">
          <span
            className={`size-2 rounded-full ${!connected ? 'bg-muted-foreground/40' : isRetrying ? 'bg-warning' : 'bg-success'}`}
            title={connected ? (isRetrying ? 'Retrying...' : 'Agent connected') : undefined}
          />
          <span className="font-medium truncate max-w-32 @md/conversation:max-w-64">
            {sessionName}
          </span>
          {connected && (
            <>
              {isRetrying && retryInfo ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <RetryCountdown retryInfo={retryInfo} />
                </>
              ) : compacting || session?.time?.compacting ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="size-2.5 animate-spin" />
                    Compacting
                  </span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground tabular-nums">
                    {shownTokens?.toLocaleString() ?? '—'} tokens
                    {shownPct !== undefined && !contextExceeded && (
                      <span className="hidden @md/conversation:inline"> / {shownPct}%</span>
                    )}
                  </span>
                  {contextExceeded ? (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-destructive font-medium">Context exceeded</span>
                    </>
                  ) : null}
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">{Math.round(shownCost * 100)} credits</span>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={() => openChangesTab?.(undefined, activeId)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <GitCompare className="size-3" />
                    <span>Changes</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {(() => {
          if (!sessionError) return null
          const err = sessionError as any
          const msg = err.data?.message || err.message || err.name || String(sessionError)
          if (msg.toLowerCase().includes('abort')) return null
          const isContext =
            (err.code || err.data?.code) === 'context_length_exceeded' || msg.includes('context')
          return (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs border-t animate-in slide-in-from-top-1',
                isContext ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive',
              )}
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <p className="flex-1 min-w-0 font-medium truncate">
                {isContext ? 'Context limit reached. Start a new session.' : msg}
              </p>
              <button
                onClick={dismissError}
                className="p-0.5 rounded transition-colors hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </div>
          )
        })()}
      </header>

      {/* Chat */}
      {tab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div ref={scrollRef} className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
              <div
                ref={contentRef}
                className="max-w-3xl mx-auto px-2 py-4 @md/conversation:px-4 @md/conversation:py-6 overflow-hidden"
              >
                {loading ? (
                  <div className="flex items-center justify-center min-h-[300px]">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : visibleMessages.length ? (
                  <AgentThread
                    projectId={projectId}
                    sessionId={activeId!}
                    messages={visibleMessages}
                    partsMap={parts}
                    permissions={permissions}
                    isWorking={working}
                    onRevert={handleRevert}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </ScrollArea>
            {/* Scroll to bottom button */}
            {showScrollButton && (
              <button
                onClick={() => scrollToBottom(true)}
                className={cn(
                  'absolute bottom-4 right-4 z-10',
                  'flex items-center justify-center size-9 rounded-full',
                  'bg-primary text-primary-foreground shadow-lg',
                  'hover:bg-primary/90 transition-all',
                  'animate-in fade-in slide-in-from-bottom-2 duration-200',
                )}
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="size-4" />
              </button>
            )}
          </div>

          {/* Input */}
          <div className="px-2 py-2 shrink-0 relative @md/conversation:px-4 @md/conversation:py-4">
            <div className="max-w-3xl mx-auto">
              {/* Revert banner */}
              {revertMessageId && (
                <div className="mb-2 px-3 py-2 rounded-lg border border-warning/20 bg-warning/10 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-warning font-medium">
                      Changes reverted. File modifications have been undone.
                    </span>
                    <button
                      onClick={handleUnrevert}
                      disabled={unrevert.isPending}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/20 hover:bg-warning/30 text-warning font-medium transition-colors disabled:opacity-50"
                    >
                      {unrevert.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Redo2 className="size-3" />
                      )}
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              )}
              {lastAssistantError && (
                <div
                  className={cn(
                    'mb-2 px-3 py-2 rounded-lg border text-xs',
                    lastAssistantError.isContext
                      ? 'bg-warning/10 border-warning/20 text-warning'
                      : 'bg-muted/50 text-muted-foreground',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <p className="flex-1 min-w-0 wrap-break-word line-clamp-2">
                      {lastAssistantError.message}
                    </p>
                    <button
                      onClick={handleCreate}
                      disabled={create.isPending}
                      className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors shrink-0 hover:bg-muted"
                    >
                      {create.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3" />
                      )}
                      <span>New session</span>
                    </button>
                  </div>
                </div>
              )}
              {questions.length > 0 && (
                <div className="mb-3 space-y-2">
                  {questions.map((q) => {
                    const pending =
                      (replyQuestion.isPending && replyQuestion.variables?.id === q.id) ||
                      (rejectQuestion.isPending && rejectQuestion.variables === q.id)
                    return (
                      <QuestionPrompt
                        key={q.id}
                        request={q}
                        onReply={(answers) => replyQuestion.mutate({ id: q.id, answers })}
                        onReject={() => rejectQuestion.mutate(q.id)}
                        pending={pending}
                      />
                    )
                  })}
                </div>
              )}
              <ChatInput
                onSubmit={handleSend}
                disabled={working}
                placeholder={working ? 'Working...' : 'Ask anything...'}
                mode={mode}
                onToggleMode={() => setMode((m) => (m === 'plan' ? 'orchestrator' : 'plan'))}
                isWorking={working}
                onStop={handleAbort}
                isStopping={abort.isPending}
                value={inputValue}
                onValueChange={setInputValue}
                models={availableModels}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                subagents={subagents}
              />
            </div>
          </div>
        </div>
      )}

      {/* Terminal */}
      {showTerminal && tab === 'terminal' && (
        <div className="flex-1 min-h-0 p-3">
          <TerminalWidget sandboxId={sandboxId} className="size-full rounded-lg" />
        </div>
      )}

      <ProviderDialog open={providerOpen} onOpenChange={setProviderOpen} projectId={projectId} />
    </div>
  )
}
