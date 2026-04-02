'use client'

import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  CircleNotch,
} from '@phosphor-icons/react'
import type { ComponentProps } from 'react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type IframeError, useSandbox } from '@/hooks/use-sandbox'
import { cn } from '@/lib/utils'

export type WebPreviewContextValue = {
  url: string
  setUrl: (url: string) => void
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
  refresh: () => void
  reloadTick: number
  iframeRef: React.RefObject<HTMLIFrameElement | null>
}

const WebPreviewContext = createContext<WebPreviewContextValue | null>(null)

export const useOptionalWebPreview = () => useContext(WebPreviewContext)

const useWebPreview = () => {
  const context = useOptionalWebPreview()
  if (!context) {
    throw new Error('WebPreview components must be used within a WebPreview')
  }
  return context
}

type ErrorMessage = {
  type: 'error'
  payload?: Record<string, unknown>
}

type ParsedIframeError = {
  message: string
  stack?: string
  url?: string
  timestamp?: string
  source?: IframeError['source']
}

const SOURCES: IframeError['source'][] = ['global', 'promise', 'react', 'react-router', 'preload']
const GENERIC_ERROR_MESSAGES = ['unknown error', 'script error', 'script error.', 'error']

const nonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const parseJson = (value: unknown) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const extractMessage = (value: unknown, depth = 0): string | null => {
  if (depth > 4) return null
  const text = nonEmptyString(value)
  if (text) return text

  const obj = asRecord(value)
  if (!obj) return null

  return (
    extractMessage(obj.message, depth + 1) ??
    extractMessage(obj.error, depth + 1) ??
    extractMessage(obj.reason, depth + 1) ??
    extractMessage(obj.cause, depth + 1) ??
    extractMessage(obj.detail, depth + 1) ??
    extractMessage(obj.description, depth + 1) ??
    extractMessage(obj.data, depth + 1)
  )
}

const extractStack = (value: unknown, depth = 0): string | null => {
  if (depth > 4) return null
  const obj = asRecord(value)
  if (!obj) return null

  return (
    nonEmptyString(obj.stack) ??
    nonEmptyString(obj.stackTrace) ??
    extractStack(obj.error, depth + 1) ??
    extractStack(obj.reason, depth + 1) ??
    extractStack(obj.cause, depth + 1) ??
    extractStack(obj.data, depth + 1)
  )
}

const getStackHeadline = (stack: string | undefined) =>
  stack
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('at ')) ?? null

const isGenericMessage = (message: string | null | undefined) =>
  !!message && GENERIC_ERROR_MESSAGES.includes(message.trim().toLowerCase())

const parseMessage = (data: unknown): ParsedIframeError | null => {
  const parsed = parseJson(data)
  if (typeof parsed !== 'object' || parsed === null) return null
  if ((parsed as ErrorMessage).type !== 'error') return null
  const payload = asRecord(parseJson((parsed as ErrorMessage).payload))
  if (!payload) return null

  const sourceValue = nonEmptyString(payload.source)
  const source = SOURCES.includes(sourceValue as IframeError['source'])
    ? (sourceValue as IframeError['source'])
    : undefined
  const stack = nonEmptyString(payload.stack) ?? extractStack(payload) ?? undefined
  const stackHeadline = getStackHeadline(stack)
  const baseMessage =
    extractMessage(payload.message) ??
    extractMessage(payload.error) ??
    extractMessage(payload.reason) ??
    extractMessage(payload) ??
    stackHeadline
  // If the message is generic (e.g. cross-origin "Script error") and there's
  // no stack headline to fall back on, suppress the error — it's not actionable.
  if (isGenericMessage(baseMessage) && !stackHeadline) return null
  const message =
    isGenericMessage(baseMessage) && stackHeadline && !isGenericMessage(stackHeadline)
      ? stackHeadline
      : baseMessage
  const location = asRecord(payload.location)
  const url =
    nonEmptyString(payload.url) ??
    nonEmptyString(payload.href) ??
    nonEmptyString(location?.href) ??
    undefined

  if (!source && (!message || !url)) return null
  if (!message) return null

  return {
    message,
    stack,
    url,
    timestamp: nonEmptyString(payload.timestamp) ?? undefined,
    source,
  }
}

export type WebPreviewProps = ComponentProps<'div'> & {
  defaultUrl?: string
  onUrlChange?: (url: string) => void
}

export const WebPreview = ({
  className,
  children,
  defaultUrl = '',
  onUrlChange,
  ...props
}: WebPreviewProps) => {
  const [reloadTick, setReloadTick] = useState(0)
  const [nav, setNav] = useState(() => ({
    history: [defaultUrl],
    index: 0,
  }))
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const hiddenAtRef = useRef<number | null>(null)
  const setIframeError = useSandbox((s) => s.setIframeError)

  const url = nav.history[nav.index] ?? ''

  // Listen for error messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (document.visibilityState !== 'visible') return
      const msg = parseMessage(event.data)
      if (!msg) return

      setIframeError({
        message: msg.message,
        url: msg.url || iframeRef.current?.src || url,
        stack: msg.stack,
        timestamp: msg.timestamp || new Date().toISOString(),
        source: msg.source || 'global',
      })
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setIframeError, url])

  // Clear error on URL change or refresh
  const clearError = useCallback(() => {
    setIframeError(null)
  }, [setIframeError])

  // Handle iframe recovery from bfcache restore or tab visibility changes.
  // - pageshow.persisted: browser restored page from bfcache, iframe state is stale
  // - visibilitychange: tab was hidden >1s and has an error, attempt recovery
  useEffect(() => {
    const reloadIframe = () => {
      setIframeError(null)
      if (iframeRef.current && url) {
        iframeRef.current.src = url
        setReloadTick((v) => v + 1)
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reloadIframe()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      if (document.visibilityState !== 'visible') return

      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (!hiddenAt) return
      if (Date.now() - hiddenAt < 1000) return
      if (!useSandbox.getState().iframeError) return

      reloadIframe()
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [setIframeError, url])

  useEffect(() => {
    onUrlChange?.(url)
  }, [url, onUrlChange])

  const setUrl = (nextUrl: string) => {
    clearError()
    setNav((prev) => {
      const current = prev.history[prev.index] ?? ''
      if (nextUrl === current) return prev

      const history = [...prev.history.slice(0, prev.index + 1), nextUrl]
      return { history, index: history.length - 1 }
    })
  }

  const canGoBack = nav.index > 0
  const canGoForward = nav.index < nav.history.length - 1

  const goBack = () => {
    clearError()
    setNav((prev) => (prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev))
  }

  const goForward = () => {
    clearError()
    setNav((prev) =>
      prev.index < prev.history.length - 1 ? { ...prev, index: prev.index + 1 } : prev,
    )
  }

  const refresh = () => {
    clearError()
    if (iframeRef.current) {
      iframeRef.current.src = url
      setReloadTick((v) => v + 1)
    }
  }

  const contextValue: WebPreviewContextValue = {
    url,
    setUrl,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    refresh,
    reloadTick,
    iframeRef,
  }

  return (
    <WebPreviewContext.Provider value={contextValue}>
      <div className={cn('flex size-full flex-col border bg-card', className)} {...props}>
        {children}
      </div>
    </WebPreviewContext.Provider>
  )
}

export type WebPreviewNavigationProps = ComponentProps<'div'>

export const WebPreviewNavigation = ({
  className,
  children,
  ...props
}: WebPreviewNavigationProps) => (
  <div
    className={cn('flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5', className)}
    {...props}
  >
    {children}
  </div>
)

const navBtnClass =
  'inline-flex cursor-pointer items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-25 disabled:pointer-events-none disabled:cursor-default'

export const WebPreviewNavButtons = () => {
  const { canGoBack, canGoForward, goBack, goForward, refresh, url } = useWebPreview()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canGoBack}
              onClick={goBack}
              className={navBtnClass}
              aria-label="Back"
            >
              <CaretLeft className="size-3.5" weight="bold" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Back</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canGoForward}
              onClick={goForward}
              className={navBtnClass}
              aria-label="Forward"
            >
              <CaretRight className="size-3.5" weight="bold" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Forward</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={refresh} className={navBtnClass} aria-label="Refresh">
              <ArrowClockwise className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(navBtnClass, !url && 'pointer-events-none opacity-25')}
              aria-label="Open in new tab"
            >
              <ArrowSquareOut className="size-3.5" />
            </a>
          </TooltipTrigger>
          <TooltipContent>Open in new tab</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

export type WebPreviewUrlProps = ComponentProps<'input'>

const getPathname = (url: string) => {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return '/'
  }
}

export const WebPreviewUrl = ({ className, ...props }: WebPreviewUrlProps) => {
  const { url, setUrl } = useWebPreview()
  const [path, setPath] = useState(() => getPathname(url))

  useEffect(() => {
    setPath(getPathname(url))
  }, [url])

  const handleNavigate = () => {
    try {
      const newUrl = new URL(url)
      newUrl.pathname = path.startsWith('/') ? path : `/${path}`
      setUrl(newUrl.toString())
    } catch {
      // ignore invalid url
    }
  }

  return (
    <div
      className={cn(
        'flex h-7 w-full max-w-sm items-center rounded-md border border-border/50 bg-muted/40 px-2.5',
        className,
      )}
    >
      <input
        className="w-full bg-transparent text-[13px] text-muted-foreground outline-none placeholder:text-muted-foreground/40"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
        placeholder="/"
        aria-label="App preview path"
        type="text"
        {...props}
      />
    </div>
  )
}

export type WebPreviewBodyProps = ComponentProps<'iframe'>

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'failed'
const WATCHDOG_MS = 10000
const ONLOAD_FALLBACK_MS = 3000

const DEVICE_DIMENSIONS: Record<string, { w: number; h: number }> = {
  mobile: { w: 375, h: 667 },
  tablet: { w: 768, h: 1024 },
}

const IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-presentation allow-pointer-lock allow-storage-access-by-user-activation allow-downloads'

const IFRAME_ALLOW =
  'autoplay; camera; clipboard-read; clipboard-write; geolocation; display-capture; encrypted-media; fullscreen; gamepad; gyroscope; magnetometer; microphone; midi; payment; usb; bluetooth; hid; serial; xr-spatial-tracking; screen-wake-lock; idle-detection; publickey-credentials-get; local-fonts; window-management'

export const WebPreviewBody = ({ className, src, onLoad, ...props }: WebPreviewBodyProps) => {
  const { url, iframeRef, reloadTick } = useWebPreview()
  const setIframeError = useSandbox((s) => s.setIframeError)
  const previewRefreshTick = useSandbox((s) => s.previewRefreshTick)
  const deviceFrame = useSandbox((s) => s.deviceFrame)
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [glowing, setGlowing] = useState(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onLoadFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef(0)
  const prevRefreshTick = useRef(previewRefreshTick)
  const currentUrl = src ?? url

  // Auto-refresh when dev-run completes (via sandbox store signal)
  // Directly sets iframe.src to avoid triggering the loading overlay
  useEffect(() => {
    if (previewRefreshTick === prevRefreshTick.current) return
    prevRefreshTick.current = previewRefreshTick
    if (!currentUrl) return

    setGlowing(true)
    const timer = setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.src = currentUrl
      }
      setTimeout(() => setGlowing(false), 1200)
    }, 300)
    return () => clearTimeout(timer)
  }, [previewRefreshTick, currentUrl, iframeRef])

  const clearTimers = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
    if (onLoadFallbackRef.current) {
      clearTimeout(onLoadFallbackRef.current)
      onLoadFallbackRef.current = null
    }
  }, [])

  const markReady = useCallback(() => {
    clearTimers()
    setStatus('ready')
  }, [clearTimers])

  const startWatchdog = useCallback(
    function startWatchdog(nextUrl: string) {
      clearTimers()
      watchdogRef.current = setTimeout(() => {
        if (retryRef.current === 0) {
          retryRef.current = 1
          if (iframeRef.current) iframeRef.current.src = nextUrl
          startWatchdog(nextUrl)
          return
        }
        setStatus('failed')
      }, WATCHDOG_MS)
    },
    [clearTimers, iframeRef],
  )

  // Main loading effect - handles URL/reload changes, watchdog, and message listener
  useEffect(() => {
    if (!currentUrl) {
      clearTimers()
      setStatus('idle')
      return
    }

    retryRef.current = 0
    setStatus('loading')

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type === 'preview-ready') markReady()
    }

    startWatchdog(currentUrl)
    window.addEventListener('message', handleMessage)
    return () => {
      clearTimers()
      window.removeEventListener('message', handleMessage)
    }
  }, [currentUrl, reloadTick, iframeRef, markReady, clearTimers, startWatchdog])

  // onLoad = HTML loaded, not React rendered. Wait for preview-ready postMessage.
  // Delayed fallback for templates that don't send preview-ready.
  const handleLoad: ComponentProps<'iframe'>['onLoad'] = (event) => {
    onLoad?.(event)
    // Cancel watchdog — iframe HTML has loaded, no need to retry or fail
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
    if (onLoadFallbackRef.current) clearTimeout(onLoadFallbackRef.current)
    onLoadFallbackRef.current = setTimeout(() => {
      setStatus((prev) => (prev === 'loading' || prev === 'failed' ? 'ready' : prev))
    }, ONLOAD_FALLBACK_MS)
  }

  const handleRetry = () => {
    retryRef.current = 0
    setStatus('loading')
    clearTimers()
    setIframeError(null)
    if (iframeRef.current && currentUrl) {
      iframeRef.current.src = currentUrl
      startWatchdog(currentUrl)
    }
  }

  const dims = deviceFrame ? DEVICE_DIMENSIONS[deviceFrame] : null

  return (
    <div className="relative flex-1">
      {dims ? (
        <div className="flex size-full items-center justify-center overflow-auto bg-muted/20 p-4">
          <div
            className="shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm"
            style={{ width: dims.w, height: dims.h }}
          >
            <iframe
              ref={iframeRef}
              className="size-full"
              sandbox={IFRAME_SANDBOX}
              allow={IFRAME_ALLOW}
              src={currentUrl || undefined}
              title="Preview"
              onLoad={handleLoad}
              {...props}
            />
          </div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className={cn('size-full', className)}
          sandbox={IFRAME_SANDBOX}
          allow={IFRAME_ALLOW}
          src={currentUrl || undefined}
          title="Preview"
          onLoad={handleLoad}
          {...props}
        />
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <CircleNotch weight="bold" className="size-4 animate-spin text-muted-foreground/50" />
        </div>
      )}
      {status === 'failed' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <p className="text-sm text-muted-foreground">Preview is taking longer than expected.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <ArrowClockwise className="size-3.5 mr-1.5" />
                Retry
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  currentUrl && window.open(currentUrl, '_blank', 'noopener,noreferrer')
                }
              >
                <ArrowSquareOut className="size-3.5 mr-1.5" />
                Open in new tab
              </Button>
            </div>
          </div>
        </div>
      )}
      {glowing && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
          <div className="absolute -inset-1 preview-glow-edge opacity-0" />
          <div className="absolute inset-0 preview-glow-border opacity-0" />
        </div>
      )}
    </div>
  )
}
