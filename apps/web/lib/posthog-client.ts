'use client'

import posthog from 'posthog-js'

export function captureClientException(error: Error) {
  if (posthog.__loaded) posthog.captureException(error)
}

export function identifyClientUser(user: { id: string; email?: string | null }) {
  if (posthog.__loaded) posthog.identify(user.id, { email: user.email })
}
