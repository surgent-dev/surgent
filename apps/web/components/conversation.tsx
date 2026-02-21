'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { Message, Part, ToolPart } from '@opencode-ai/sdk'
import { format, parseISO } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { http } from '@/lib/http'
import {
  Loader2,
  Plus,
  AlertCircle,
  X,
  RefreshCw,
  Redo2,
  GitCompare,
  ArrowDown,
  MoreHorizontal,
} from 'lucide-react'
import { Chat, ArrowElbowDownRight } from '@phosphor-icons/react'
import { MODELS, type ProviderModel } from '@/lib/models'
import ChatInput, { type FilePart } from './chat-input'
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
  type SendPartInput,
  type AgentModelOverride,
} from '@/queries/chats'
import ProviderDialog from '@/components/provider-dialog'
import { useFunMessage } from '@/components/ui/fun-loading'

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

const formatTitle = (title: string) => {
  const isoMatch = title.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  if (!isoMatch) return title
  try {
    return format(parseISO(isoMatch[0]), 'MMM d HH:mm')
  } catch {
    return title
  }
}

function generateAscendingId(prefix: 'msg' | 'prt'): string {
  const now = Date.now()
  if (now !== lastAscendingIdTimestamp) {
    lastAscendingIdTimestamp = now
    ascendingIdCounter = 0
  }
  ascendingIdCounter += 1

  const value = BigInt(now) * BigInt(0x1000) + BigInt(ascendingIdCounter)
  const bytes = new Uint8Array(6)
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((value >> BigInt(40 - 8 * i)) & BigInt(0xff))
  }
  return `${prefix}_${bytesToHex(bytes)}${randomBase62(14)}`
}

let lastAscendingIdTimestamp = 0
let ascendingIdCounter = 0
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function bytesToHex(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0
    result += byte.toString(16).padStart(2, '0')
  }
  return result
}

function randomBase62(length: number): string {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  let result = ''
  for (const byte of bytes) {
    result += BASE62[byte % 62]
  }
  return result
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

function ConversationSkeleton() {
  return (
    <div className="space-y-6 pt-6 animate-in fade-in duration-300">
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </div>
  )
}

function InputSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 p-3.5 animate-pulse">
      <Skeleton className="h-4 w-28 mb-3" />
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="size-7 rounded-lg" />
        </div>
        <Skeleton className="size-8 rounded-full" />
      </div>
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

  const [mode, setMode] = useState<'plan' | 'orchestrator'>('orchestrator')
  const [providerOpen, setProviderOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [subagentWorking, setSubagentWorking] = useState(false)
  const [selectedModel, setSelectedModel] = useState<
    { modelId: string; providerId: string } | undefined
  >(undefined)

  const storedSessionId = useSandbox((s) => (projectId ? s.activeSessionId[projectId] : undefined))
  const setActiveSession = useSandbox((s) => s.setActiveSession)
  const openChangesTab = useSandbox((s) => s.openChangesTab)

  const sessionsQuery = useSessionsQuery(projectId)
  const sessions = sessionsQuery.data ?? []
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
    addOptimisticMessage,
    removeOptimisticMessage,
    isRetrying,
    retryInfo,
  } = useAgentStream({ projectId, sessionId: activeId })

  const working = useMemo(() => {
    if (status?.type) return status.type !== 'idle'
    const timeline = messages.flatMap((m) => parts[m.id] || [])
    return computeWorkingFromParts(timeline)
  }, [status, messages, parts])
  const inputWorking = working || subagentWorking

  const funMessage = useFunMessage()
  const sessionsErrorMessage = sessionsQuery.error
    ? sessionsQuery.error instanceof Error
      ? sessionsQuery.error.message
      : String(sessionsQuery.error)
    : null
  const showSkeleton = loading || sessionsQuery.isLoading || (!activeId && !sessionsQuery.isError)
  const inputDisabled = inputWorking || create.isPending || showSkeleton || !activeId
  const inputPlaceholder = inputWorking ? funMessage : 'Ask anything...'

  useEffect(() => {
    if (!projectId || !activeId) return
    if (storedSessionId === activeId) return
    setActiveSession(projectId, activeId)
  }, [activeId, projectId, setActiveSession, storedSessionId])

  useEffect(() => {
    setSubagentWorking(false)
  }, [activeId])

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

  // Auto-send initial prompt once session is connected and ready
  useEffect(() => {
    if (!initialPrompt || prefilledRef.current) return
    const text = initialPrompt.trim()
    if (!text) return
    if (!activeId || showSkeleton || !connected) return

    prefilledRef.current = true
    handleSend(text)

    // Clean up URL param
    try {
      const params = new URLSearchParams(searchParams?.toString?.() || '')
      if (params.has('initial')) {
        params.delete('initial')
        router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false })
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, activeId, showSkeleton, connected])

  // Handle pending prompt from error overlay "Fix with AI"
  const pendingPrompt = useSandbox((s) => s.pendingPrompt)
  const setPendingPrompt = useSandbox((s) => s.setPendingPrompt)
  const requestPreviewRefresh = useSandbox((s) => s.requestPreviewRefresh)
  useEffect(() => {
    if (!pendingPrompt) return
    setInputValue(pendingPrompt)
    setPendingPrompt(null)
  }, [pendingPrompt, setPendingPrompt])

  const handleSend = (text: string, files?: FilePart[], model?: string, providerID?: string) => {
    const trimmed = text.trim()
    if ((!trimmed && !files?.length) || inputWorking || !activeId) return

    setInputValue('')
    const messageId = generateAscendingId('msg')

    const requestParts: SendPartInput[] = []

    if (trimmed) {
      requestParts.push({
        id: generateAscendingId('prt'),
        type: 'text',
        text: trimmed,
      })
    }

    if (files?.length) {
      for (const file of files) {
        requestParts.push({
          id: generateAscendingId('prt'),
          type: 'file',
          mime: file.mime,
          filename: file.filename,
          url: file.url,
          size: file.size,
        })
      }
    }

    const optimisticMessage: Message = {
      id: messageId,
      sessionID: activeId,
      role: 'user',
      time: { created: Date.now() },
      agent: mode,
      model: model && providerID ? { providerID, modelID: model } : undefined,
    } as Message

    const optimisticParts: Part[] = requestParts
      .filter((part) => !!part.id)
      .map((part) => ({
        ...part,
        messageID: messageId,
        sessionID: activeId,
      }))
      .sort((a, b) => a.id!.localeCompare(b.id!)) as Part[]

    addOptimisticMessage({
      message: optimisticMessage,
      parts: optimisticParts,
    })

    const coder = model && providerID ? { model: { providerID, modelID: model } } : undefined
    const agentOverrides = coder ? { coder } : undefined

    send.mutate(
      {
        sessionId: activeId,
        messageId,
        agent: mode,
        parts: requestParts,
        model,
        providerID,
        agentOverrides,
      },
      {
        onError: () => {
          removeOptimisticMessage(messageId)
        },
      },
    )
  }

  const handleAbort = () => {
    if (!activeId || !projectId) return
    abort.mutate({ projectId, sessionId: activeId })
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

  // Unified error display (combines session errors and assistant errors)
  const displayError = useMemo(() => {
    if (!activeId && sessionsQuery.isError && sessionsErrorMessage) {
      return {
        message: sessionsErrorMessage,
        isContext: false,
        isDismissible: false,
      }
    }
    if (sessionError) {
      const err = sessionError as any
      const msg = err.data?.message || err.message || err.name || String(sessionError)
      if (msg.toLowerCase().includes('abort')) return null
      const isContext =
        (err.code || err.data?.code) === 'context_length_exceeded' || msg.includes('context')
      return {
        message: isContext ? 'Context limit reached. Start a new session.' : msg,
        isContext,
        isDismissible: true,
      }
    }
    if (lastAssistantError) {
      return { ...lastAssistantError, isDismissible: false }
    }
    return null
  }, [activeId, lastAssistantError, sessionError, sessionsErrorMessage, sessionsQuery.isError])

  const { data: providerData } = useQuery<ProviderResponse>({
    queryKey: ['opencode-models', projectId],
    enabled: Boolean(projectId),
    staleTime: 60_000,
    queryFn: async () => http.get(`api/agent/${projectId}/provider`).json<ProviderResponse>(),
  })

  const availableModels = useMemo(() => {
    if (!providerData) return MODELS
    const provider = providerData.all?.find((item) => item.id === 'opencode')
    if (!provider?.models) return MODELS
    const fromProvider = MODELS.filter((model) => Boolean(provider.models[model.id]))
    return fromProvider.length ? fromProvider : MODELS
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

  // Auto-refresh preview when dev-run tool completes
  const refreshedToolIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    refreshedToolIds.current = new Set()
  }, [activeId])

  useEffect(() => {
    let shouldRefresh = false
    for (const m of messages) {
      const msgParts = parts[m.id]
      if (!msgParts) continue
      for (const p of msgParts) {
        if (
          p.type === 'tool' &&
          p.tool === 'dev-run' &&
          (p as ToolPart).state.status === 'completed' &&
          !refreshedToolIds.current.has(p.id)
        ) {
          refreshedToolIds.current.add(p.id)
          shouldRefresh = true
        }
      }
    }
    if (shouldRefresh) requestPreviewRefresh()
  }, [messages, parts, requestPreviewRefresh])

  const shownTokens = usageRef.current?.ctxTokens
  const shownPct = usageRef.current?.contextPct
  const contextExceeded = usageRef.current?.contextExceeded

  return (
    <div className="flex flex-col h-full w-full min-w-0 @container/conversation">
      {/* Header */}
      <header className="flex h-10 items-center shrink-0 px-6 gap-2 min-w-0 text-xs">
        <span
          className={cn(
            'size-2 rounded-full shrink-0 transition-colors',
            !connected && 'bg-muted-foreground/30',
            connected && isRetrying && 'bg-warning',
            connected && !isRetrying && 'bg-emerald-500',
          )}
        />
        <span className="font-medium truncate max-w-40 @md/conversation:max-w-72">
          {sessionName}
        </span>

        {connected && isRetrying && retryInfo && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <RetryCountdown retryInfo={retryInfo} />
          </>
        )}

        {connected && !isRetrying && (compacting || session?.time?.compacting) && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <Loader2 className="size-2.5 animate-spin" />
              Compacting
            </span>
          </>
        )}

        {connected && !isRetrying && !compacting && !session?.time?.compacting && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/70 tabular-nums">
              {shownTokens?.toLocaleString() ?? '—'} tokens
              {shownPct !== undefined && !contextExceeded && (
                <span className="hidden @md/conversation:inline"> / {shownPct}%</span>
              )}
            </span>
            {contextExceeded && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-destructive font-medium">Context exceeded</span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <button
              onClick={() => openChangesTab?.(undefined, activeId)}
              className="flex items-center gap-1 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <GitCompare className="size-3" />
              <span>Changes</span>
            </button>
          </>
        )}

        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center size-7 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
              aria-label="Session menu"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={handleCreate} disabled={create.isPending} className="gap-2">
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              <span>New session</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
                    className={cn(
                      'gap-1.5 pl-5',
                      sub.id === activeId ? 'bg-accent' : 'text-muted-foreground',
                    )}
                  >
                    <ArrowElbowDownRight className="size-3" />
                    <span className="truncate text-xs">{formatTitle(sub.title || 'Task')}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Chat */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <div ref={scrollRef} className="flex-1 min-h-0 min-w-0 relative">
          <ScrollArea className="h-full">
            <div ref={contentRef} className="max-w-3xl mx-auto px-6 py-4 overflow-hidden">
              {showSkeleton ? (
                <ConversationSkeleton />
              ) : visibleMessages.length ? (
                <AgentThread
                  projectId={projectId}
                  sessionId={activeId!}
                  messages={visibleMessages}
                  partsMap={parts}
                  permissions={permissions}
                  isWorking={working}
                  onSubagentWorkingChange={setSubagentWorking}
                  onRevert={handleRevert}
                />
              ) : null}
            </div>
          </ScrollArea>
          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={() => scrollToBottom(true)}
              className={cn(
                'absolute bottom-3 right-3 z-10',
                'flex items-center justify-center size-8 rounded-full',
                'bg-muted/80 text-muted-foreground backdrop-blur-sm border border-border/40',
                'hover:bg-muted hover:text-foreground transition-all',
                'animate-in fade-in slide-in-from-bottom-2 duration-200',
              )}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="size-3.5" />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="px-6 pb-5 pt-1 shrink-0 relative">
          <div className="max-w-3xl mx-auto">
            {/* Revert banner */}
            {revertMessageId && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-warning/8 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-warning font-medium">
                    Changes reverted. File modifications have been undone.
                  </span>
                  <button
                    onClick={handleUnrevert}
                    disabled={unrevert.isPending}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/15 hover:bg-warning/25 text-warning text-xs font-medium transition-colors disabled:opacity-50"
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
            {displayError && (
              <div
                className={cn(
                  'mb-2 px-3 py-2 rounded-lg text-xs',
                  displayError.isContext
                    ? 'bg-warning/8 text-warning'
                    : 'bg-destructive/8 text-destructive',
                )}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <p className="flex-1 min-w-0 wrap-break-word line-clamp-2">
                    {displayError.message}
                  </p>
                  {displayError.isDismissible && (
                    <button
                      onClick={dismissError}
                      className="p-1 rounded-md transition-colors shrink-0 hover:bg-muted/50"
                      aria-label="Dismiss"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                  <button
                    onClick={handleCreate}
                    disabled={create.isPending}
                    className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors shrink-0 hover:bg-muted/50"
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
            {showSkeleton ? (
              <InputSkeleton />
            ) : (
              <ChatInput
                onSubmit={handleSend}
                disabled={inputDisabled}
                placeholder={inputPlaceholder}
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
            )}
          </div>
        </div>
      </div>

      <ProviderDialog open={providerOpen} onOpenChange={setProviderOpen} projectId={projectId} />
    </div>
  )
}
