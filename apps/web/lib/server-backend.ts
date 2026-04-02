import 'server-only'

const PROD_BACKEND_URL = 'https://api.surgent.dev'
const LOCAL_BACKEND_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function isLocalhostUrl(value: string) {
  try {
    return LOCAL_BACKEND_HOSTS.has(new URL(value).hostname)
  } catch {
    return false
  }
}

export function getServerBackendUrl() {
  const explicitUrl = process.env.BACKEND_URL ?? process.env.SERVER_BACKEND_URL
  if (explicitUrl) {
    return trimTrailingSlash(explicitUrl)
  }

  const publicUrl = process.env.NEXT_PUBLIC_BACKEND_URL
  if (publicUrl) {
    const shouldPreferProdFallback =
      process.env.NODE_ENV === 'production' && isLocalhostUrl(publicUrl)

    if (!shouldPreferProdFallback) {
      return trimTrailingSlash(publicUrl)
    }
  }

  return PROD_BACKEND_URL
}

export const serverBackendUrl = getServerBackendUrl()
