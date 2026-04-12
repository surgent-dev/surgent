'use client'

import type { AssistantMessage, Message, Part, Permission, Session } from '@opencode-ai/sdk'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useProjectEvents } from '@/context/project-events'
import type { QuestionRequest } from './question'

type AgentError = AssistantMessage['error']

// Session status types matching backend SessionStatus.Info
type SessionStatusIdle = { type: 'idle' }
type SessionStatusBusy = { type: 'busy' }
type SessionStatusRetry = { type: 'retry'; attempt: number; message: string; next: number }
type SessionStatus = SessionStatusIdle | SessionStatusBusy | SessionStatusRetry

type State = {
  messages: Message[]
  parts: Record<string, Part[]>
  permissions: Permission[]
  questions: QuestionRequest[]
  session?: Session
  status?: SessionStatus
  error?: AgentError
  lastAt: number
  connected: boolean
  loading: boolean
  compacting: boolean
  replaceOnNextBatch: boolean
}

type OptimisticMessageInput = {
  message: Message
  parts: Part[]
}

type StreamEvent = Event | { type: string; properties?: Record<string, any> }

type SessionScope = { sessionID?: string; sessionId?: string }

export const initialStreamState: State = {
  messages: [],
  parts: {},
  permissions: [],
  questions: [],
  lastAt: 0,
  connected: false,
  loading: false,
  compacting: false,
  replaceOnNextBatch: false,
}

function upsertMessage(list: Message[], incoming: Message): Message[] {
  const idx = list.findIndex((m) => m.id === incoming.id)
  if (idx === -1) {
    const insertAt = list.findIndex((m) => m.id > incoming.id)
    if (insertAt === -1) return [...list, incoming]
    return [...list.slice(0, insertAt), incoming, ...list.slice(insertAt)]
  }
  const merged = { ...list[idx], ...incoming } as Message
  return [...list.slice(0, idx), merged, ...list.slice(idx + 1)]
}

function getPartText(part: Part): string | undefined {
  const value = (part as Record<string, unknown>).text
  return typeof value === 'string' ? value : undefined
}

function getPartEnd(part: Part): number | undefined {
  const time = (part as { time?: { end?: number } }).time
  return typeof time?.end === 'number' ? time.end : undefined
}

// Merge a snapshot part without regressing text that deltas already built up.
function mergeSnapshotPart(existing: Part | undefined, incoming: Part): Part {
  if (!existing) return incoming
  const merged = { ...existing, ...incoming } as Part
  const existingText = getPartText(existing)
  const incomingText = getPartText(incoming)
  if (existingText === undefined || incomingText === undefined) return merged
  const existingEnd = getPartEnd(existing)
  const incomingEnd = getPartEnd(incoming)
  if (existingEnd && !incomingEnd) return existing
  if (incomingEnd || existingText.length <= incomingText.length) return merged
  return { ...merged, text: existingText } as Part
}

// Insert or merge a part into a sorted list, using snapshot-safe merge.
function upsertPart(list: Part[] | undefined, incoming: Part): Part[] {
  if (!list) return [incoming]
  const idx = list.findIndex((p) => p.id === incoming.id)
  if (idx === -1) {
    const insertAt = list.findIndex((p) => p.id > incoming.id)
    if (insertAt === -1) return [...list, incoming]
    return [...list.slice(0, insertAt), incoming, ...list.slice(insertAt)]
  }
  const merged = mergeSnapshotPart(list[idx], incoming)
  return [...list.slice(0, idx), merged, ...list.slice(idx + 1)]
}

function mergeParts(
  existing: Part[] | undefined,
  incoming: Part[] | undefined,
): Part[] | undefined {
  if (incoming === undefined) return existing
  if (!existing) return incoming
  let next = existing
  for (const part of incoming) {
    next = upsertPart(next, part)
  }
  return next
}

function upsertPermission(list: Permission[] | undefined, incoming: Permission): Permission[] {
  if (!list) return [incoming]
  const idx = list.findIndex((p) => p.id === incoming.id)
  if (idx === -1) return [...list, incoming]
  const merged = { ...list[idx], ...incoming } as Permission
  return [...list.slice(0, idx), merged, ...list.slice(idx + 1)]
}

export function reduceStreamState(
  state: State,
  event: StreamEvent,
  currentSessionId?: string,
): State {
  const props = (event as any).properties
  const now = Date.now()

  // Handle events without properties
  if (!props) {
    switch (event.type) {
      case 'session.deleted':
        return {
          ...state,
          session: undefined,
          status: undefined,
          messages: [],
          parts: {},
          permissions: [],
          questions: [],
          lastAt: now,
          loading: true,
          error: undefined,
          replaceOnNextBatch: false,
        }
      case 'connection.closed':
        return { ...state, connected: false, lastAt: now }
      case 'server.connected':
        return { ...state, connected: true, lastAt: now }
      case 'server.heartbeat':
        // Keep-alive ping, just update timestamp
        return { ...state, lastAt: now }
      case 'error.clear':
        return { ...state, error: undefined }
      default:
        return { ...state, lastAt: now }
    }
  }

  switch (event.type) {
    // Batch load for initial messages - single dispatch instead of N+M
    case 'batch.load': {
      const items = props.messages as Array<{ info: Message; parts: Part[] }>
      const waitingForReplacement = state.replaceOnNextBatch && !items?.length
      if (!items?.length) {
        return {
          ...state,
          loading: false,
          compacting: waitingForReplacement ? state.compacting : false,
          replaceOnNextBatch: waitingForReplacement,
          lastAt: now,
        }
      }

      const shouldReplaceSnapshot = state.replaceOnNextBatch
      let messages = shouldReplaceSnapshot ? [] : state.messages
      const parts: Record<string, Part[]> = shouldReplaceSnapshot ? {} : { ...state.parts }
      for (const { info, parts: msgParts } of items) {
        const sessionID =
          (info as Message & SessionScope).sessionID || (info as SessionScope).sessionId
        if (sessionID && sessionID !== currentSessionId) continue
        messages = upsertMessage(messages, info)
        const merged = mergeParts(parts[info.id], msgParts)
        if (merged !== undefined) parts[info.id] = merged
      }
      return {
        ...state,
        messages,
        parts,
        lastAt: now,
        loading: false,
        compacting: false,
        replaceOnNextBatch: false,
      }
    }

    case 'batch.load.error':
      return { ...state, loading: false, compacting: false, lastAt: now }

    // Session events
    case 'session.created':
      return { ...state, lastAt: now }

    case 'session.updated': {
      const info = props.info as Session
      if (info.id !== currentSessionId) return state
      return { ...state, session: info, lastAt: now }
    }

    case 'session.deleted': {
      const sessionID = props.sessionID || props.sessionId || props.info?.id
      if (sessionID !== currentSessionId) return state
      return {
        ...state,
        session: undefined,
        status: undefined,
        messages: [],
        parts: {},
        permissions: [],
        questions: [],
        lastAt: now,
        error: undefined,
        replaceOnNextBatch: false,
      }
    }

    case 'session.error': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID && sessionID !== currentSessionId) return state
      return { ...state, error: props.error, lastAt: now }
    }

    case 'session.compacted': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID !== currentSessionId) return state
      return {
        ...state,
        questions: [],
        lastAt: now,
        loading: false,
        compacting: true,
        replaceOnNextBatch: true,
      }
    }

    // Session status events (matching backend SessionStatus.Info types)
    case 'session.status': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID !== currentSessionId) return state
      const status = props.status as SessionStatus
      return { ...state, status, lastAt: now }
    }

    case 'session.idle': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID !== currentSessionId) return state
      return { ...state, status: { type: 'idle' }, lastAt: now }
    }

    // Message events
    case 'message.updated': {
      const info = props.info as Message & SessionScope
      const sessionID = info.sessionID || info.sessionId
      if (sessionID !== currentSessionId) return state
      return { ...state, messages: upsertMessage(state.messages, info), lastAt: now }
    }

    case 'message.removed': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID && sessionID !== currentSessionId) return state
      const parts = { ...state.parts }
      delete parts[props.messageID]
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== props.messageID),
        parts,
        lastAt: now,
      }
    }

    // Part events
    case 'message.part.updated': {
      const part = props.part as Part & SessionScope
      const sessionID = part.sessionID || part.sessionId
      if (sessionID !== currentSessionId) return state
      return {
        ...state,
        parts: {
          ...state.parts,
          [part.messageID]: upsertPart(state.parts[part.messageID], part),
        },
        lastAt: now,
      }
    }

    case 'message.part.delta': {
      const { messageID, partID, field, delta } = props as {
        messageID: string
        partID: string
        field: string
        delta: string
      }
      const sessionID = props.sessionID || props.sessionId
      if (sessionID && sessionID !== currentSessionId) return state
      const msgParts = state.parts[messageID]
      if (!msgParts) return state
      const idx = msgParts.findIndex((p) => p.id === partID)
      if (idx === -1) return state
      const part = msgParts[idx]
      const existing = (part as Record<string, unknown>)[field] as string | undefined
      const updated = { ...part, [field]: (existing ?? '') + delta } as Part
      return {
        ...state,
        parts: {
          ...state.parts,
          [messageID]: [...msgParts.slice(0, idx), updated, ...msgParts.slice(idx + 1)],
        },
        lastAt: now,
      }
    }

    case 'message.part.removed': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID && sessionID !== currentSessionId) return state
      const parts = { ...state.parts }
      const filtered = parts[props.messageID]?.filter((p) => p.id !== props.partID)
      if (filtered) parts[props.messageID] = filtered
      else delete parts[props.messageID]
      return { ...state, parts, lastAt: now }
    }

    // Server events
    case 'server.connected':
      return { ...state, connected: true, lastAt: now }

    case 'server.heartbeat':
      return { ...state, lastAt: now }

    case 'server.instance.disposed':
      return { ...state, connected: false, lastAt: now }

    // Permission events
    case 'permission.updated':
    case 'permission.asked': {
      const permission = props as Permission & SessionScope
      const sessionID = permission.sessionID || permission.sessionId
      if (sessionID !== currentSessionId) return state
      return {
        ...state,
        permissions: upsertPermission(state.permissions, permission),
        lastAt: now,
      }
    }

    case 'permission.replied': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID !== currentSessionId) return state
      const permissionID = props.permissionID || props.requestID
      if (!permissionID) return state
      return {
        ...state,
        permissions: state.permissions.filter((p) => p.id !== permissionID),
        lastAt: now,
      }
    }

    // Question events
    case 'question.asked': {
      if (!props.questions?.length) return state
      const sessionID = props.sessionID || props.sessionId || currentSessionId
      if (!sessionID || sessionID !== currentSessionId) return state
      const req: QuestionRequest = {
        id: props.id || `q_${now}`,
        sessionID,
        questions: props.questions,
        tool: props.tool,
      }
      return { ...state, questions: [...state.questions, req], lastAt: now }
    }

    case 'question.replied':
    case 'question.rejected': {
      const sessionID = props.sessionID || props.sessionId
      if (sessionID && sessionID !== currentSessionId) return state
      const id = props.id || props.requestID
      if (!id) return state
      return { ...state, questions: state.questions.filter((q) => q.id !== id), lastAt: now }
    }

    // Optimistic message handling
    case 'optimistic.add': {
      const { messageId, message, parts: msgParts } = props
      return {
        ...state,
        messages: upsertMessage(state.messages, message as Message),
        parts: { ...state.parts, [messageId]: msgParts },
        lastAt: now,
      }
    }

    case 'optimistic.remove': {
      const optimisticId = props.messageId as string | undefined
      if (!optimisticId) return state
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== optimisticId),
        parts: (() => {
          const { [optimisticId]: _, ...rest } = state.parts
          return rest
        })(),
        lastAt: now,
      }
    }

    default:
      return state
  }
}

export default function useAgentStream({
  projectId,
  sessionId,
}: {
  projectId?: string
  sessionId?: string
}) {
  const { subscribe: eventSubscribe, connected: eventConnected } = useProjectEvents()

  const [state, dispatch] = useReducer(
    (state: State, event: StreamEvent) => reduceStreamState(state, event, sessionId),
    initialStreamState,
  )

  const currentKeyRef = useRef(projectId && sessionId ? `${projectId}:${sessionId}` : '')

  useEffect(() => {
    if (!projectId || !sessionId) {
      if (!currentKeyRef.current) return
      dispatch({ type: 'session.deleted' } as any)
      currentKeyRef.current = ''
      return
    }

    const key = `${projectId}:${sessionId}`
    if (currentKeyRef.current === key) return
    dispatch({ type: 'session.deleted' } as any)
    currentKeyRef.current = key
  }, [projectId, sessionId])

  useEffect(() => {
    if (!projectId || !sessionId) return
    const unsubscribe = eventSubscribe(sessionId, (event) => dispatch(event))
    return unsubscribe
  }, [eventSubscribe, projectId, sessionId])

  useEffect(() => {
    if (!projectId) {
      dispatch({ type: 'connection.closed' } as any)
      return
    }
    if (eventConnected) {
      dispatch({ type: 'server.connected' } as any)
      return
    }
    dispatch({ type: 'connection.closed' } as any)
  }, [eventConnected, projectId])

  const dismissError = useCallback(() => dispatch({ type: 'error.clear' } as any), [])

  // Add optimistic message for instant UI feedback
  const addOptimisticMessage = useCallback((input: OptimisticMessageInput) => {
    const messageId = input.message.id
    if (!messageId) return
    dispatch({
      type: 'optimistic.add',
      properties: { messageId, message: input.message, parts: input.parts },
    } as any)
  }, [])

  // Remove optimistic message when send fails
  const removeOptimisticMessage = useCallback((messageId: string) => {
    dispatch({
      type: 'optimistic.remove',
      properties: { messageId },
    } as any)
  }, [])

  // Helper to check if we're in retry state
  const isRetrying = state.status?.type === 'retry'
  const retryInfo = isRetrying ? (state.status as SessionStatusRetry) : null
  const { replaceOnNextBatch: _replaceOnNextBatch, ...publicState } = state

  return {
    ...publicState,
    dismissError,
    addOptimisticMessage,
    removeOptimisticMessage,
    isRetrying,
    retryInfo,
  }
}

export type { QuestionAnswer, QuestionInfo, QuestionOption, QuestionRequest } from './question'
// Export types for use in components
export type { AgentError, SessionStatus, SessionStatusRetry }
