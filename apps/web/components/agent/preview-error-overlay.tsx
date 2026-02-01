'use client'

import { useSandbox, type IframeError } from '@/hooks/use-sandbox'
import { AlertTriangle, Copy, Check, X, Bug, AlertCircle } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

const SOURCE_LABELS: Record<string, string> = {
  global: 'Runtime Error',
  promise: 'Unhandled Promise',
  react: 'React Error',
  'react-router': 'Router Error',
}

// Critical errors that can crash/white-screen the app (show full overlay)
// - global: runtime errors can crash the entire app
// - react: component errors cause white screen without error boundary
// - react-router: navigation breaks
// Only 'promise' is non-critical (fails silently, app continues)
function isCriticalError(error: IframeError): boolean {
  return error.source !== 'promise'
}

// Toast-style notification for non-critical errors
function ErrorToast({
  error,
  onDismiss,
  onFixWithAI,
  onCopy,
  copied,
}: {
  error: IframeError
  onDismiss: () => void
  onFixWithAI: () => void
  onCopy: () => void
  copied: boolean
}) {
  const label = SOURCE_LABELS[error.source] ?? 'Error'

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 pb-4 px-4">
      {/* Background scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
      <div className="relative mx-auto max-w-md rounded-lg border border-border/50 bg-background shadow-2xl">
        <div className="flex items-start gap-3 p-3">
          <div className="shrink-0 mt-0.5">
            <AlertCircle className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm mt-0.5 break-words line-clamp-2">{error.message}</p>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          <Button
            onClick={onFixWithAI}
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1.5"
          >
            <Bug className="size-3" />
            Fix with AI
          </Button>
          <Button onClick={onCopy} variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={onDismiss} variant="ghost" size="sm" className="h-7 text-xs ml-auto">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

// Floating panel for critical errors (bottom, doesn't block UI)
function CriticalErrorOverlay({
  error,
  onDismiss,
  onFixWithAI,
  onCopy,
  copied,
}: {
  error: IframeError
  onDismiss: () => void
  onFixWithAI: () => void
  onCopy: () => void
  copied: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const label = SOURCE_LABELS[error.source] ?? 'Error'

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 pb-4 px-4">
      {/* Background scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
      <div className="relative mx-auto max-w-lg rounded-xl border border-destructive/20 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-destructive/20 bg-destructive/5 rounded-t-xl">
          <AlertTriangle className="size-4 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-destructive">{label}</p>
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            {new Date(error.timestamp).toLocaleTimeString()}
          </p>
          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm break-words line-clamp-2">{error.message}</p>
          {error.stack && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? 'Hide' : 'Show'} stack trace
              </button>
              {expanded && (
                <pre className="mt-2 text-xs font-mono bg-muted/50 rounded-lg p-2.5 overflow-auto max-h-32 text-muted-foreground whitespace-pre-wrap break-words">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t bg-muted/30 rounded-b-xl">
          <Button onClick={onFixWithAI} size="sm" className="h-7 text-xs gap-1.5">
            <Bug className="size-3" />
            Fix with AI
          </Button>
          <Button onClick={onCopy} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={onDismiss} variant="ghost" size="sm" className="h-7 text-xs ml-auto">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PreviewErrorOverlay() {
  const error = useSandbox((s) => s.iframeError)
  const setError = useSandbox((s) => s.setIframeError)
  const setPendingPrompt = useSandbox((s) => s.setPendingPrompt)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const buildPrompt = useCallback(() => {
    if (!error) return ''
    const label = SOURCE_LABELS[error.source] ?? 'Error'
    return `Fix this ${label.toLowerCase()} in my app:\n\nError: ${error.message}\nURL: ${error.url}${error.stack ? `\n\nStack trace:\n${error.stack}` : ''}`
  }, [error])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt())
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }, [buildPrompt])

  const handleFixWithAI = useCallback(() => {
    setPendingPrompt(buildPrompt())
    setError(null)
  }, [buildPrompt, setPendingPrompt, setError])

  const handleDismiss = useCallback(() => {
    setError(null)
  }, [setError])

  if (!error) return null

  const isCritical = isCriticalError(error)

  if (isCritical) {
    return (
      <CriticalErrorOverlay
        error={error}
        onDismiss={handleDismiss}
        onFixWithAI={handleFixWithAI}
        onCopy={handleCopy}
        copied={copied}
      />
    )
  }

  return (
    <ErrorToast
      error={error}
      onDismiss={handleDismiss}
      onFixWithAI={handleFixWithAI}
      onCopy={handleCopy}
      copied={copied}
    />
  )
}
