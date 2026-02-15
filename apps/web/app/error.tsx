'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    posthog.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm rounded-lg bg-foreground text-background hover:opacity-85 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
