'use client'

import posthog from 'posthog-js'
import { useEffect } from 'react'

export default function ErrorPage({
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
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-all duration-100"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
