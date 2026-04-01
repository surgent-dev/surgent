import posthog from 'posthog-js'

/**
 * Fire a GA4 + PostHog event in one call.
 * Safe to call server-side (no-ops silently).
 */
export function track(event: string, params?: Record<string, unknown>) {
  // GA4
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', event, params)
  }
  // PostHog
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture(event, params)
  }
}

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}
