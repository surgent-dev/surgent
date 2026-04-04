'use client'

import type { Message, Part } from '@opencode-ai/sdk'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { backendBaseUrl, http } from '@/lib/http'

type StreamEvent = { type: string; properties?: Record<string, unknown> }
type Subscriber = (event: StreamEvent) => void

type ProjectEventContextValue = {
  connected: boolean
  subscribe: (sessionId: string, callback: Subscriber) => () => void
  syncSession: (sessionId: string, force?: boolean) => void
}

const noopUnsubscribe = () => {}
const noopSync = () => {}

const defaultValue: ProjectEventContextValue = {
  connected: false,
  subscribe: () => noopUnsubscribe,
  syncSession: noopSync,
}

const ProjectEventContext = createContext<ProjectEventContextValue>(defaultValue)

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function getString(value: unknown, key: string): string | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const item = record[key]
  return typeof item === 'string' ? item : undefined
}

function getSessionIdFromEvent(event: StreamEvent): string | undefined {
  const props = asRecord(event.properties)
  if (!props) return undefined

  if (event.type === 'session.updated') {
    return getString(props.info, 'id')
  }

  if (event.type === 'session.deleted') {
    return (
      getString(props, 'sessionID') || getString(props, 'sessionId') || getString(props.info, 'id')
    )
  }

  if (event.type === 'message.updated') {
    return getString(props.info, 'sessionID') || getString(props.info, 'sessionId')
  }

  if (event.type === 'message.part.updated') {
    return getString(props.part, 'sessionID') || getString(props.part, 'sessionId')
  }

  if (event.type === 'permission.updated') {
    return getString(props, 'sessionID') || getString(props, 'sessionId')
  }

  if (
    event.type === 'question.asked' ||
    event.type === 'question.replied' ||
    event.type === 'question.rejected'
  ) {
    return getString(props, 'sessionID') || getString(props, 'sessionId')
  }

  return getString(props, 'sessionID') || getString(props, 'sessionId')
}

function getCompactedSessionId(event: StreamEvent): string | undefined {
  if (event.type !== 'session.compacted') return undefined
  const props = asRecord(event.properties)
  if (!props) return undefined
  return getString(props, 'sessionID') || getString(props, 'sessionId')
}

function normalizeEvent(event: StreamEvent): StreamEvent {
  const props = asRecord(event.properties)
  if (!props) return event

  if (event.type === 'permission.asked') {
    const sessionID = getString(props, 'sessionID') || getString(props, 'sessionId')
    const tool = asRecord(props.tool)
    const callID = getString(props, 'callID') || getString(tool, 'callID')
    const messageID = getString(props, 'messageID') || getString(tool, 'messageID')
    const next: Record<string, unknown> = { ...props }
    if (sessionID) next.sessionID = sessionID
    if (!next.callID && callID) next.callID = callID
    if (!next.messageID && messageID) next.messageID = messageID
    if (!next.pattern && next.patterns) next.pattern = next.patterns
    return { type: 'permission.updated', properties: next }
  }

  if (event.type === 'permission.replied') {
    const sessionID = getString(props, 'sessionID') || getString(props, 'sessionId')
    const permissionID = getString(props, 'permissionID') || getString(props, 'requestID')
    const response = getString(props, 'response') || getString(props, 'reply')
    const next: Record<string, unknown> = { ...props }
    if (sessionID) next.sessionID = sessionID
    if (!next.permissionID && permissionID) next.permissionID = permissionID
    if (!next.response && response) next.response = response
    return { type: event.type, properties: next }
  }

  if (
    event.type === 'session.status' ||
    event.type === 'session.idle' ||
    event.type === 'session.compacted' ||
    event.type === 'question.asked' ||
    event.type === 'question.replied' ||
    event.type === 'question.rejected'
  ) {
    const sessionID = getString(props, 'sessionID') || getString(props, 'sessionId')
    if (!sessionID || props.sessionID === sessionID) return event
    return { type: event.type, properties: { ...props, sessionID } }
  }

  if (event.type === 'message.updated') {
    const info = asRecord(props.info)
    if (!info) return event
    const sessionID = getString(info, 'sessionID') || getString(info, 'sessionId')
    if (!sessionID || info.sessionID === sessionID) return event
    return {
      type: event.type,
      properties: { ...props, info: { ...info, sessionID } },
    }
  }

  if (event.type === 'message.part.updated') {
    const part = asRecord(props.part)
    if (!part) return event
    const sessionID = getString(part, 'sessionID') || getString(part, 'sessionId')
    if (!sessionID || part.sessionID === sessionID) return event
    return {
      type: event.type,
      properties: { ...props, part: { ...part, sessionID } },
    }
  }

  return event
}

type SseEventFrame = {
  id?: string
  event?: string
  retry?: number
  data?: string
}

function parseSseFrame(chunk: string): SseEventFrame {
  const lines = chunk.split('\n')
  const dataLines: string[] = []
  let id: string | undefined
  let event: string | undefined
  let retry: number | undefined

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^\s/, '')

    if (field === 'data') {
      dataLines.push(value)
      continue
    }
    if (field === 'id') {
      id = value
      continue
    }
    if (field === 'event') {
      event = value
      continue
    }
    if (field === 'retry') {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isNaN(parsed)) retry = parsed
    }
  }

  return {
    id,
    event,
    retry,
    data: dataLines.length ? dataLines.join('\n') : undefined,
  }
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEventFrame) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''

      for (const chunk of chunks) {
        onEvent(parseSseFrame(chunk))
      }
    }

    buffer += decoder.decode()
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    if (buffer.trim()) {
      onEvent(parseSseFrame(buffer))
    }
  } finally {
    reader.releaseLock()
  }
}

export function ProjectEventProvider({
  projectId,
  children,
}: {
  projectId?: string
  children: React.ReactNode
}) {
  const [connected, setConnected] = useState(false)
  const connectedRef = useRef(false)
  const closedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const connectionIdRef = useRef(0)
  const subscribersRef = useRef(new Map<string, Set<Subscriber>>())
  const queueRef = useRef<Array<StreamEvent | null>>([])
  const rafRef = useRef<number | null>(null)
  const attemptRef = useRef(0)
  const connectedAtRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const heartbeatCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const needsResyncRef = useRef(new Set<string>())
  const inflightRef = useRef(new Map<string, Promise<void>>())
  const retryIntervalRef = useRef<number | null>(null)

  // Heartbeat timeout - if no heartbeat in 35s, connection is likely dead
  const HEARTBEAT_TIMEOUT = 35000
  const HEARTBEAT_CHECK_INTERVAL = 5000

  const emitAll = useCallback((event: StreamEvent) => {
    for (const callbacks of subscribersRef.current.values()) {
      callbacks.forEach((callback) => {
        callback(event)
      })
    }
  }, [])

  const emitSession = useCallback((sessionId: string, event: StreamEvent) => {
    const callbacks = subscribersRef.current.get(sessionId)
    if (!callbacks) return
    callbacks.forEach((callback) => {
      callback(event)
    })
  }, [])

  const emitRouted = useCallback(
    (event: StreamEvent) => {
      const sessionId = getSessionIdFromEvent(event)
      if (sessionId) {
        emitSession(sessionId, event)
        return
      }
      emitAll(event)
    },
    [emitAll, emitSession],
  )

  const markAllSessionsForResync = useCallback(() => {
    for (const sessionId of subscribersRef.current.keys()) {
      needsResyncRef.current.add(sessionId)
    }
  }, [])

  const clearDisconnectTimer = useCallback(() => {
    if (!disconnectTimerRef.current) return
    clearTimeout(disconnectTimerRef.current)
    disconnectTimerRef.current = null
  }, [])

  const setConnectedState = useCallback(
    (value: boolean) => {
      connectedRef.current = value
      setConnected(value)
    },
    [setConnected],
  )

  const syncSession = useCallback(
    (sessionId: string, force = false) => {
      const runSync = (nextSessionId: string, nextForce = false) => {
        if (!projectId || !nextSessionId || closedRef.current) return
        if (!nextForce && !needsResyncRef.current.has(nextSessionId)) return

        const key = `${projectId}:${nextSessionId}`

        // Inflight deduplication - avoid duplicate requests
        const pending = inflightRef.current.get(key)
        if (pending) {
          needsResyncRef.current.add(nextSessionId)
          return
        }

        needsResyncRef.current.delete(nextSessionId)

        const syncMessages = http
          .get(`api/agent/${projectId}/session/${nextSessionId}/message`, {
            retry: { limit: 3, statusCodes: [502, 503, 504], delay: () => 500 },
          })
          .json<Array<{ info: Message; parts: Part[] }>>()
          .then((items) => {
            if (closedRef.current) return
            emitSession(nextSessionId, {
              type: 'batch.load',
              properties: { messages: items ?? [] },
            })
          })
          .catch(() => {
            if (closedRef.current) return
            emitSession(nextSessionId, {
              type: 'batch.load.error',
              properties: { sessionID: nextSessionId },
            })
          })

        const syncStatus = http
          .get(`api/agent/${projectId}/session/status`, {
            retry: { limit: 3, statusCodes: [502, 503, 504], delay: () => 500 },
          })
          .json<Record<string, unknown>>()
          .then((items) => {
            if (closedRef.current) return
            const status = items?.[nextSessionId]
            if (status) {
              emitSession(nextSessionId, {
                type: 'session.status',
                properties: { sessionID: nextSessionId, status },
              })
              return
            }
            emitSession(nextSessionId, {
              type: 'session.idle',
              properties: { sessionID: nextSessionId },
            })
          })
          .catch(() => {})

        const promise = Promise.allSettled([syncMessages, syncStatus]).then(() => {
          inflightRef.current.delete(key)
          if (!needsResyncRef.current.has(nextSessionId) || closedRef.current) return
          runSync(nextSessionId, true)
        })

        inflightRef.current.set(key, promise)
      }

      runSync(sessionId, force)
    },
    [emitSession, projectId],
  )

  const subscribe = useCallback(
    (sessionId: string, callback: Subscriber) => {
      if (!sessionId) return noopUnsubscribe

      let callbacks = subscribersRef.current.get(sessionId)
      if (!callbacks) {
        callbacks = new Set<Subscriber>()
        subscribersRef.current.set(sessionId, callbacks)
      }
      callbacks.add(callback)

      needsResyncRef.current.add(sessionId)
      if (connectedRef.current) syncSession(sessionId)

      return () => {
        const current = subscribersRef.current.get(sessionId)
        if (!current) return
        current.delete(callback)
        if (current.size > 0) return
        subscribersRef.current.delete(sessionId)
        needsResyncRef.current.delete(sessionId)
      }
    },
    [syncSession],
  )

  useEffect(() => {
    if (!projectId) return

    closedRef.current = false
    connectionIdRef.current += 1
    attemptRef.current = 0
    connectedAtRef.current = 0
    lastHeartbeatRef.current = 0
    markAllSessionsForResync()

    const url = backendBaseUrl
      ? `${backendBaseUrl}/api/agent/${projectId}/event`
      : `/api/agent/${projectId}/event`

    // Event coalescing: dedup snapshots and merge deltas within a frame.
    const coalesced = new Map<string, number>()

    const eventKey = (ev: StreamEvent): string | undefined => {
      const p = ev.properties
      if (!p) return undefined
      if (ev.type === 'session.status') return `ss:${p.sessionID || p.sessionId}`
      if (ev.type === 'message.part.updated') {
        const part = p.part as Record<string, unknown> | undefined
        return part ? `mpu:${part.messageID}:${part.id}` : undefined
      }
      if (ev.type === 'message.part.delta') return `mpd:${p.messageID}:${p.partID}:${p.field}`
      return undefined
    }

    const flushQueue = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const events = queueRef.current
        queueRef.current = []
        coalesced.clear()
        for (const event of events) {
          if (event) emitRouted(event)
        }
      })
    }

    const enqueue = (event: StreamEvent) => {
      // A full snapshot supersedes any queued deltas for the same part
      if (event.type === 'message.part.updated') {
        const part = (event.properties as any)?.part
        if (part) {
          const prefix = `mpd:${part.messageID}:${part.id}:`
          for (let i = 0; i < queueRef.current.length; i++) {
            const q = queueRef.current[i]
            if (!q) continue
            const k = eventKey(q)
            if (k?.startsWith(prefix)) {
              coalesced.delete(k)
              queueRef.current[i] = null
            }
          }
        }
      }

      const key = eventKey(event)
      if (!key) {
        queueRef.current.push(event)
        return
      }

      const idx = coalesced.get(key)
      if (idx === undefined) {
        coalesced.set(key, queueRef.current.length)
        queueRef.current.push(event)
        return
      }

      // Merge consecutive deltas by concatenating their text
      const queued = queueRef.current[idx]
      if (queued?.type === 'message.part.delta' && event.type === 'message.part.delta') {
        const prev = (queued.properties as any)?.delta ?? ''
        const next = (event.properties as any)?.delta ?? ''
        queueRef.current[idx] = {
          ...event,
          properties: { ...event.properties, delta: prev + next },
        }
        return
      }

      queueRef.current[idx] = event
    }

    const scheduleReconnect = () => {
      if (closedRef.current) return

      if (heartbeatCheckRef.current) {
        clearInterval(heartbeatCheckRef.current)
        heartbeatCheckRef.current = null
      }

      // Faster disconnect detection - 5s instead of 15s
      if (!disconnectTimerRef.current) {
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null
          setConnectedState(false)
          emitAll({ type: 'connection.closed' })
        }, 5000)
      }

      const connectedFor = connectedAtRef.current ? Date.now() - connectedAtRef.current : 0
      if (connectedFor >= 10000) {
        attemptRef.current = 0
      }

      if (reconnectTimerRef.current) return
      const attempt = attemptRef.current
      // Use server-specified retry interval if available, otherwise exponential backoff
      const serverRetry = retryIntervalRef.current
      const baseDelay =
        serverRetry ?? (attempt === 0 ? 300 : Math.min(1000 * 2 ** (attempt - 1), 30000))
      const jitter = 0.9 + Math.random() * 0.2
      const delay = Math.round(baseDelay * jitter)
      attemptRef.current = Math.min(attempt + 1, 10)
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const triggerReconnect = () => {
      if (closedRef.current) return
      abortRef.current?.abort()
      scheduleReconnect()
    }

    const connect = () => {
      if (closedRef.current) return

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort
      const connectionId = connectionIdRef.current + 1
      connectionIdRef.current = connectionId

      connectedAtRef.current = 0
      lastHeartbeatRef.current = 0
      clearDisconnectTimer()

      // Clear heartbeat check interval
      if (heartbeatCheckRef.current) {
        clearInterval(heartbeatCheckRef.current)
        heartbeatCheckRef.current = null
      }

      fetch(url, {
        method: 'GET',
        headers: { accept: 'text/event-stream' },
        credentials: 'include',
        cache: 'no-store',
        signal: abort.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`SSE failed: ${response.status}`)
          if (!response.body) throw new Error('SSE body missing')
          if (closedRef.current || connectionId !== connectionIdRef.current) return

          const now = Date.now()
          connectedAtRef.current = now
          lastHeartbeatRef.current = now
          attemptRef.current = 0
          clearDisconnectTimer()
          setConnectedState(true)
          emitAll({ type: 'server.connected' })

          // Start heartbeat timeout detection
          heartbeatCheckRef.current = setInterval(() => {
            if (closedRef.current || connectionId !== connectionIdRef.current) return
            const timeSinceHeartbeat = Date.now() - lastHeartbeatRef.current
            if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
              // Connection likely dead, force reconnect
              triggerReconnect()
            }
          }, HEARTBEAT_CHECK_INTERVAL)

          for (const sessionId of subscribersRef.current.keys()) {
            syncSession(sessionId, true)
          }

          await readSseStream(response.body, ({ data, retry }) => {
            if (closedRef.current || connectionId !== connectionIdRef.current) return
            if (retry !== undefined) retryIntervalRef.current = retry
            if (!data) return

            try {
              const raw = JSON.parse(data) as StreamEvent
              const event = normalizeEvent(raw)

              // Update heartbeat timestamp on any message (heartbeat or data)
              lastHeartbeatRef.current = Date.now()

              if (event.type === 'server.heartbeat') {
                attemptRef.current = 0
                // Don't emit heartbeat events to subscribers
                return
              }

              const compactedSessionId = getCompactedSessionId(event)
              if (compactedSessionId) {
                needsResyncRef.current.add(compactedSessionId)
                syncSession(compactedSessionId, true)
              }

              enqueue(event)
              flushQueue()
            } catch {}
          })

          if (closedRef.current || connectionId !== connectionIdRef.current) return
          scheduleReconnect()
        })
        .catch(() => {
          if (closedRef.current || connectionId !== connectionIdRef.current) return
          scheduleReconnect()
        })
    }

    connect()

    const inflight = inflightRef.current

    return () => {
      closedRef.current = true
      clearDisconnectTimer()

      if (heartbeatCheckRef.current) {
        clearInterval(heartbeatCheckRef.current)
        heartbeatCheckRef.current = null
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      abortRef.current?.abort()
      abortRef.current = null

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      queueRef.current = []
      coalesced.clear()
      inflight.clear()

      setConnectedState(false)
      emitAll({ type: 'connection.closed' })
    }
  }, [
    clearDisconnectTimer,
    emitAll,
    emitRouted,
    markAllSessionsForResync,
    projectId,
    setConnectedState,
    syncSession,
  ])

  const value = useMemo(
    () => ({
      connected,
      subscribe,
      syncSession,
    }),
    [connected, subscribe, syncSession],
  )

  return <ProjectEventContext.Provider value={value}>{children}</ProjectEventContext.Provider>
}

export function useProjectEvents() {
  return useContext(ProjectEventContext)
}
