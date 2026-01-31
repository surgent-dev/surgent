'use client'

import { useSandbox, type IframeError } from '@/hooks/use-sandbox'
import { AlertTriangle, Copy, Check, X, Bug } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

const SOURCE_LABELS: Record<string, string> = {
  global: 'Runtime Error',
  promise: 'Unhandled Promise',
  react: 'React Error',
  'react-router': 'Router Error',
}

export function PreviewErrorOverlay() {
  const error = useSandbox((s) => s.iframeError)
  const setError = useSandbox((s) => s.setIframeError)
  const setPendingPrompt = useSandbox((s) => s.setPendingPrompt)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
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

  if (!error) return null

  const label = SOURCE_LABELS[error.source] ?? 'Error'

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="w-full max-w-lg rounded-xl border border-destructive/30 bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-destructive/20 bg-destructive/5">
          <div className="rounded-full bg-destructive/10 p-2">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-destructive">{label}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(error.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium break-words">{error.message}</p>
          {error.stack && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? 'Hide' : 'Show'} stack trace
              </button>
              {expanded && (
                <pre className="mt-2 text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-40 text-muted-foreground whitespace-pre-wrap break-words">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/30">
          <Button onClick={handleFixWithAI} size="sm" className="gap-2">
            <Bug className="size-4" />
            Fix with AI
          </Button>
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <div className="flex-1" />
          <Button onClick={() => setError(null)} variant="ghost" size="sm">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}
