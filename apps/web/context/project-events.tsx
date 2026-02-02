'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Message, Part } from '@opencode-ai/sdk'
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
  const esRef = useRef<EventSource | null>(null)
  const subscribersRef = useRef(new Map<string, Set<Subscriber>>())
  const queueRef = useRef<StreamEvent[]>([])
  const rafRef = useRef<number | null>(null)
  const attemptRef = useRef(0)
  const connectedAtRef = useRef(0)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const needsResyncRef = useRef(new Set<string>())
  const syncingRef = useRef(new Set<string>())

  const emitAll = useCallback((event: StreamEvent) => {
    for (const callbacks of subscribersRef.current.values()) {
      callbacks.forEach((callback) => callback(event))
    }
  }, [])

  const emitSession = useCallback((sessionId: string, event: StreamEvent) => {
    const callbacks = subscribersRef.current.get(sessionId)
    if (!callbacks) return
    callbacks.forEach((callback) => callback(event))
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
      if (!projectId || !sessionId || closedRef.current) return
      if (!force && !needsResyncRef.current.has(sessionId)) return

      if (syncingRef.current.has(sessionId)) {
        needsResyncRef.current.add(sessionId)
        return
      }

      needsResyncRef.current.delete(sessionId)
      syncingRef.current.add(sessionId)

      const syncMessages = http
        .get(`api/agent/${projectId}/session/${sessionId}/message`, {
          retry: { limit: 5, statusCodes: [502, 503, 504], delay: () => 1000 },
        })
        .json<Array<{ info: Message; parts: Part[] }>>()
        .then((items) => {
          if (closedRef.current) return
          emitSession(sessionId, {
            type: 'batch.load',
            properties: { messages: items ?? [] },
          })
        })
        .catch(() => {
          if (closedRef.current) return
          emitSession(sessionId, {
            type: 'batch.load.error',
            properties: { sessionID: sessionId },
          })
        })

      const syncStatus = http
        .get(`api/agent/${projectId}/session/status`)
        .json<Record<string, unknown>>()
        .then((items) => {
          if (closedRef.current) return
          const status = items?.[sessionId]
          if (status) {
            emitSession(sessionId, {
              type: 'session.status',
              properties: { sessionID: sessionId, status },
            })
            return
          }
          emitSession(sessionId, {
            type: 'session.idle',
            properties: { sessionID: sessionId },
          })
        })
        .catch(() => {})

      Promise.allSettled([syncMessages, syncStatus]).finally(() => {
        syncingRef.current.delete(sessionId)
        if (!needsResyncRef.current.has(sessionId) || closedRef.current) return
        syncSession(sessionId, true)
      })
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
    attemptRef.current = 0
    connectedAtRef.current = 0
    markAllSessionsForResync()

    const url = backendBaseUrl
      ? `${backendBaseUrl}/api/agent/${projectId}/event`
      : `/api/agent/${projectId}/event`

    const flushQueue = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        const events = queueRef.current
        queueRef.current = []
        rafRef.current = null
        events.forEach((event) => emitRouted(event))
      })
    }

    const connect = () => {
      if (closedRef.current) return

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      esRef.current?.close()
      connectedAtRef.current = 0
      clearDisconnectTimer()

      const es = new EventSource(url, { withCredentials: true })
      esRef.current = es

      es.onopen = () => {
        connectedAtRef.current = Date.now()
        clearDisconnectTimer()
        setConnectedState(true)
        emitAll({ type: 'server.connected' })
        for (const sessionId of subscribersRef.current.keys()) {
          syncSession(sessionId)
        }
      }

      es.onmessage = (evt) => {
        try {
          const raw = JSON.parse(evt.data) as StreamEvent
          const event = normalizeEvent(raw)
          if (event.type === 'server.heartbeat') {
            attemptRef.current = 0
          }

          const compactedSessionId = getCompactedSessionId(event)
          if (compactedSessionId) {
            needsResyncRef.current.add(compactedSessionId)
            syncSession(compactedSessionId, true)
          }

          queueRef.current.push(event)
          flushQueue()
        } catch {}
      }

      es.onerror = () => {
        es.close()
        if (closedRef.current) return

        markAllSessionsForResync()

        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            disconnectTimerRef.current = null
            setConnectedState(false)
            emitAll({ type: 'connection.closed' })
          }, 15000)
        }

        const connectedFor = connectedAtRef.current ? Date.now() - connectedAtRef.current : 0
        if (connectedFor >= 15000) {
          attemptRef.current = 0
        }

        const attempt = attemptRef.current
        const baseDelay = Math.min(3000 * Math.pow(2, attempt), 60000)
        const jitter = 0.8 + Math.random() * 0.4
        const delay = Math.round(baseDelay * jitter)
        attemptRef.current = Math.min(attempt + 1, 10)
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closedRef.current = true
      clearDisconnectTimer()

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      queueRef.current = []

      setConnectedState(false)
      emitAll({ type: 'connection.closed' })
      esRef.current?.close()
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
