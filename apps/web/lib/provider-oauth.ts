import type { QueryClient } from '@tanstack/react-query'

type ErrorLike = {
  message?: string
  data?: { message?: string }
  error?: { message?: string }
}

export function getProviderQueryKey() {
  return ['byok-providers'] as const
}

export function getProviderAuthQueryKey() {
  return ['provider-auth'] as const
}

export function invalidateProviderQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: getProviderQueryKey() })
}

export function createProviderOAuthPopup() {
  return window.open('', 'surgent-chatgpt-oauth', 'popup,width=540,height=760')
}

export function openProviderOAuthPopup(url: string) {
  const popup = createProviderOAuthPopup()
  navigateProviderOAuthPopup(popup, url)
  return popup
}

function navigateProviderOAuthPopup(popup: Window | null, url: string) {
  if (!popup || popup.closed) return false
  popup.location.href = url
  popup.focus()
  return true
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const value = error as ErrorLike | undefined
  if (typeof value?.data?.message === 'string' && value.data.message) return value.data.message
  if (typeof value?.message === 'string' && value.message) return value.message
  if (typeof value?.error?.message === 'string' && value.error.message) return value.error.message
  return fallback
}
