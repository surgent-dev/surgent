import { PostHog } from 'posthog-node'

let posthogInstance: PostHog | null = null

export function getPostHogServer() {
  const key = process.env.POSTHOG_KEY
  if (!key) return null

  if (!posthogInstance) {
    posthogInstance = new PostHog(key, {
      host: process.env.POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogInstance
}
