const CHATGPT_AUTH_CLAIM = 'https://api.openai.com/auth'
const CHATGPT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const CHATGPT_TOKEN_URL = 'https://auth.openai.com/oauth/token'
const CHATGPT_REFRESH_SKEW_MS = 60_000

type JwtClaims = Record<string, unknown> & {
  chatgpt_account_id?: string
  organizations?: Array<{ id?: string }>
  [CHATGPT_AUTH_CLAIM]?: {
    chatgpt_account_id?: string
  }
}

export type ApiProviderCredentials = {
  type: 'api'
  apiKey: string
}

export type ChatgptProviderCredentials = {
  type: 'chatgpt'
  accessToken: string
  refreshToken?: string
  accountId: string
  expiresAt?: number
}

export type ProviderCredentials = ApiProviderCredentials | ChatgptProviderCredentials

function parseExpires(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
    const t = Date.parse(value)
    if (!Number.isNaN(t)) return t
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  const padded = pad === 0 ? base64 : base64 + '='.repeat(4 - pad)
  return atob(padded)
}

function decodeJwtPayload(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return

  try {
    return JSON.parse(decodeBase64Url(parts[1] ?? '')) as JwtClaims
  } catch {
    return
  }
}

function extractAccountIdFromClaims(claims: JwtClaims) {
  return (
    claims.chatgpt_account_id ||
    claims[CHATGPT_AUTH_CLAIM]?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

function getAccountIdFromToken(token: string) {
  const payload = decodeJwtPayload(token)
  if (!payload) return
  return extractAccountIdFromClaims(payload)
}

function parseJsonCredentials(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return
  }
}

export function parseProviderCredentials(raw: string): ProviderCredentials {
  const value = raw.trim()
  const json = value.startsWith('{') ? parseJsonCredentials(value) : undefined
  if (!json) {
    return {
      type: 'api',
      apiKey: value,
    }
  }

  const type = json.type
  if (
    type === 'chatgpt' ||
    typeof json.accessToken === 'string' ||
    typeof json.access === 'string'
  ) {
    const accessToken =
      typeof json.accessToken === 'string'
        ? json.accessToken
        : typeof json.access === 'string'
          ? json.access
          : ''
    const refreshToken =
      typeof json.refreshToken === 'string'
        ? json.refreshToken
        : typeof json.refresh === 'string'
          ? json.refresh
          : undefined
    const accountId =
      typeof json.accountId === 'string'
        ? json.accountId
        : typeof json.chatgptAccountId === 'string'
          ? json.chatgptAccountId
          : getAccountIdFromToken(accessToken)
    if (!accessToken || !accountId) {
      throw new Error('Invalid ChatGPT provider credentials.')
    }
    return {
      type: 'chatgpt',
      accessToken,
      refreshToken,
      accountId,
      expiresAt: parseExpires(json.expiresAt ?? json.expires),
    }
  }

  const apiKey =
    typeof json.apiKey === 'string'
      ? json.apiKey
      : typeof json.key === 'string'
        ? json.key
        : undefined
  if (!apiKey) {
    throw new Error('Invalid provider credentials.')
  }

  return {
    type: 'api',
    apiKey,
  }
}

export function shouldRefreshChatgptCredentials(auth: ChatgptProviderCredentials) {
  return (
    typeof auth.expiresAt === 'number' && auth.expiresAt <= Date.now() + CHATGPT_REFRESH_SKEW_MS
  )
}

export async function refreshChatgptCredentials(auth: ChatgptProviderCredentials) {
  if (!auth.refreshToken) {
    throw new Error('ChatGPT provider credentials are missing a refresh token.')
  }

  const response = await fetch(CHATGPT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
      client_id: CHATGPT_CLIENT_ID,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `ChatGPT token refresh failed (${response.status}): ${text || response.statusText}`,
    )
  }

  const json = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    id_token?: string
  }
  if (
    typeof json.access_token !== 'string' ||
    typeof json.refresh_token !== 'string' ||
    typeof json.expires_in !== 'number'
  ) {
    throw new Error('ChatGPT token refresh response was missing required fields.')
  }

  return {
    type: 'chatgpt',
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accountId:
      (typeof json.id_token === 'string' ? getAccountIdFromToken(json.id_token) : undefined) ??
      getAccountIdFromToken(json.access_token) ??
      auth.accountId,
    expiresAt: Date.now() + json.expires_in * 1000,
  } satisfies ChatgptProviderCredentials
}

export function serializeProviderCredentials(auth: ProviderCredentials) {
  if (auth.type === 'api') return auth.apiKey
  return JSON.stringify({
    type: auth.type,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accountId: auth.accountId,
    expiresAt: auth.expiresAt,
  })
}
