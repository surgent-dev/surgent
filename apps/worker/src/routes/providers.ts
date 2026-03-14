import { Context, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { config } from '@/lib/config'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { isAdmin } from '../middleware/admin'
import { setTimeout as sleep } from 'node:timers/promises'

const providers = new Hono<AppContext>()
type ProviderContext = Context<AppContext>

const providerParam = z.object({ provider: z.string() })
const providerSchema = z.object({
  provider: z.string().min(1).max(64),
  credentials: z.string(),
})
const oauthAuthorizeSchema = z.object({
  method: z.number(),
})
const oauthCallbackSchema = z.object({
  method: z.number(),
  code: z.string().optional(),
  requestId: z.string().uuid().optional(),
})

providers.use('*', async (c, next) => {
  if (c.req.path === '/openai/oauth/browser/callback') return next()
  return requireAuth(c, next)
})

type User = { id: string; role?: string | null }

type OpenAiDevicePendingAuth = {
  organizationId: string
  provider: 'openai'
  method: 'device'
  deviceAuthId: string
  userCode: string
  interval: number
}

type OpenAiBrowserPendingAuth = {
  organizationId: string
  provider: 'openai'
  method: 'browser'
  state: string
  codeVerifier: string
  redirectUri: string
}

type OpenAiPendingAuth = OpenAiDevicePendingAuth | OpenAiBrowserPendingAuth
type JwtClaims = Record<string, unknown> & {
  chatgpt_account_id?: string
  organizations?: Array<{ id?: string }>
  [CHATGPT_AUTH_CLAIM]?: {
    chatgpt_account_id?: string
  }
}
type TokenResponse = {
  id_token?: string
  access_token: string
  refresh_token: string
  expires_in?: number
}
type ProviderAuthType = 'api' | 'chatgpt'

const OPENAI_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const OPENAI_ISSUER = 'https://auth.openai.com'
const OPENAI_USER_AGENT = 'opencode'
const CHATGPT_AUTH_CLAIM = 'https://api.openai.com/auth'
const DEVICE_POLL_TIMEOUT_MS = 300_000
const DEVICE_POLL_SAFETY_MARGIN_MS = 3000

const authMethods = {
  openai: [
    { type: 'oauth' as const, label: 'ChatGPT Plus/Pro (device code)' },
    { type: 'api' as const, label: 'Manually enter API Key' },
  ],
  anthropic: [{ type: 'api' as const, label: 'Manually enter API Key' }],
  google: [{ type: 'api' as const, label: 'Manually enter API Key' }],
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  const padded = pad === 0 ? base64 : base64 + '='.repeat(4 - pad)
  return atob(padded)
}

async function generatePkce() {
  const verifier = generateRandomString(43)
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return {
    verifier,
    challenge: base64UrlEncode(hash),
  }
}

function generateRandomString(length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((value) => chars[value % chars.length])
    .join('')
}

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateState() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer)
}

function buildAuthorizeUrl(input: { redirectUri: string; codeChallenge: string; state: string }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OPENAI_CLIENT_ID,
    redirect_uri: input.redirectUri,
    scope: 'openid profile email offline_access',
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state: input.state,
    originator: 'opencode',
  })
  return `${OPENAI_ISSUER}/oauth/authorize?${params.toString()}`
}

async function readResponseError(response: Response, fallback: string) {
  return (await response.text().catch(() => '')) || fallback
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

function extractAccountId(tokens: { id_token?: string; access_token?: string }) {
  for (const token of [tokens.id_token, tokens.access_token]) {
    if (!token) continue
    const claims = decodeJwtPayload(token)
    if (!claims) continue
    const id =
      claims.chatgpt_account_id ||
      claims[CHATGPT_AUTH_CLAIM]?.chatgpt_account_id ||
      claims.organizations?.[0]?.id
    if (typeof id === 'string' && id.length > 0) return id
  }
}

async function ensureOrganizationAccess(organizationId: string, user: User) {
  if (isAdmin(user)) return true

  const member = await db
    .selectFrom('member')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', user.id)
    .executeTakeFirst()

  return Boolean(member)
}

async function upsertProviderCredentials(input: {
  organizationId: string
  provider: string
  credentials: string
}) {
  const now = new Date()
  await db
    .insertInto('provider')
    .values({
      id: crypto.randomUUID(),
      projectId: null,
      organizationId: input.organizationId,
      provider: input.provider,
      credentials: input.credentials,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .onConflict((oc) =>
      oc.columns(['organizationId', 'provider']).doUpdateSet({
        credentials: input.credentials,
        projectId: null,
        deletedAt: null,
        updatedAt: now,
      }),
    )
    .execute()
}

function getProviderAuthType(credentials: string): ProviderAuthType {
  const value = credentials.trim()
  if (!value.startsWith('{')) return 'api'

  try {
    const json = JSON.parse(value) as Record<string, unknown>
    if (
      json.type === 'chatgpt' ||
      typeof json.accessToken === 'string' ||
      typeof json.access === 'string'
    ) {
      return 'chatgpt'
    }
  } catch {}

  return 'api'
}

function jsonError(c: ProviderContext, error: string, status: ContentfulStatusCode) {
  return c.json({ error }, status)
}

type AuthorizedOrganization =
  | { ok: true; organizationId: string }
  | { ok: false; error: string; status: 400 | 401 | 403 }

async function getAuthorizedOrganization(c: ProviderContext): Promise<AuthorizedOrganization> {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return { ok: false, error: 'No active organization', status: 400 }

  const user = c.get('user')
  if (!user) return { ok: false, error: 'Unauthorized', status: 401 }

  const allowed = await ensureOrganizationAccess(organizationId, user)
  if (!allowed) return { ok: false, error: 'Forbidden', status: 403 }

  return { ok: true, organizationId }
}

async function storeOpenAiChatgptCredentials(input: {
  organizationId: string
  tokens: TokenResponse
}) {
  const accountId = extractAccountId(input.tokens)
  if (!accountId) {
    throw new Error('Could not extract ChatGPT account ID from token.')
  }

  await upsertProviderCredentials({
    organizationId: input.organizationId,
    provider: 'openai',
    credentials: JSON.stringify({
      type: 'chatgpt',
      accessToken: input.tokens.access_token,
      refreshToken: input.tokens.refresh_token,
      accountId,
      expiresAt: Date.now() + (input.tokens.expires_in ?? 3600) * 1000,
    }),
  })
}

async function createOpenAiDeviceAuthorization() {
  const response = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': OPENAI_USER_AGENT,
    },
    body: JSON.stringify({ client_id: OPENAI_CLIENT_ID }),
  })
  if (!response.ok) {
    throw new Error(
      await readResponseError(response, 'Failed to start ChatGPT device authorization.'),
    )
  }

  const data = (await response.json()) as {
    device_auth_id: string
    user_code: string
    interval: string
  }

  return {
    deviceAuthId: data.device_auth_id,
    userCode: data.user_code,
    interval: Math.max(parseInt(data.interval) || 5, 1),
  }
}

async function pollOpenAiDeviceAuthorization(input: OpenAiDevicePendingAuth) {
  const deadline = Date.now() + DEVICE_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const response = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': OPENAI_USER_AGENT,
      },
      body: JSON.stringify({
        device_auth_id: input.deviceAuthId,
        user_code: input.userCode,
      }),
    })

    if (response.ok) {
      return (await response.json()) as {
        authorization_code: string
        code_verifier: string
      }
    }

    if (response.status !== 403 && response.status !== 404) {
      throw new Error(await readResponseError(response, 'ChatGPT device authorization failed.'))
    }

    await sleep(input.interval * 1000 + DEVICE_POLL_SAFETY_MARGIN_MS)
  }

  throw new Error('Authorization still pending. Finish the browser step, then try again.')
}

async function exchangeOpenAiAuthorization(input: {
  code: string
  redirectUri: string
  codeVerifier: string
}) {
  const response = await fetch(`${OPENAI_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: OPENAI_CLIENT_ID,
      code_verifier: input.codeVerifier,
    }),
  })
  if (!response.ok) {
    throw new Error(await readResponseError(response, 'ChatGPT token exchange failed.'))
  }

  return (await response.json()) as TokenResponse
}

async function createPendingAuth(input: OpenAiPendingAuth, id = crypto.randomUUID()) {
  await db
    .deleteFrom('verification')
    .where('identifier', '=', 'provider-oauth')
    .where('expiresAt', '<', new Date())
    .execute()

  await db
    .insertInto('verification')
    .values({
      id,
      identifier: 'provider-oauth',
      value: JSON.stringify(input),
      expiresAt: new Date(Date.now() + 15 * 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute()
  return id
}

async function getPendingAuth(id: string) {
  const row = await db
    .selectFrom('verification')
    .select(['id', 'value', 'expiresAt'])
    .where('id', '=', id)
    .where('identifier', '=', 'provider-oauth')
    .executeTakeFirst()

  if (!row || row.expiresAt <= new Date()) return

  try {
    return JSON.parse(row.value) as OpenAiPendingAuth
  } catch {
    return
  }
}

async function deletePendingAuth(id: string) {
  await db.deleteFrom('verification').where('id', '=', id).execute()
}

function buildOAuthResultRedirect(input: {
  ok: boolean
  requestId: string
  provider: string
  error?: string
}) {
  const url = new URL('/auth/provider-callback', config.server.clientOrigin)
  url.searchParams.set('provider', input.provider)
  url.searchParams.set('requestId', input.requestId)
  url.searchParams.set('ok', input.ok ? '1' : '0')
  if (input.error) url.searchParams.set('error', input.error)
  return url.toString()
}

providers.get('/auth', async (c) => {
  const auth = await getAuthorizedOrganization(c)
  if (!auth.ok) return jsonError(c, auth.error, auth.status)

  return c.json(authMethods)
})

providers.post(
  '/:provider/oauth/authorize',
  zValidator('param', providerParam),
  zValidator('json', oauthAuthorizeSchema),
  async (c) => {
    const { provider } = c.req.valid('param')
    const { method } = c.req.valid('json')
    const auth = await getAuthorizedOrganization(c)
    if (!auth.ok) return jsonError(c, auth.error, auth.status)
    const { organizationId } = auth

    if (provider !== 'openai') {
      return jsonError(c, 'OAuth is not supported for this provider yet.', 400)
    }
    if (method !== 0) {
      return jsonError(c, 'Invalid auth method.', 400)
    }

    const deviceAuth = await createOpenAiDeviceAuthorization()
    const requestId = await createPendingAuth({
      organizationId,
      provider: 'openai',
      method: 'device',
      deviceAuthId: deviceAuth.deviceAuthId,
      userCode: deviceAuth.userCode,
      interval: deviceAuth.interval,
    })

    return c.json({
      url: `${OPENAI_ISSUER}/codex/device`,
      method: 'auto',
      instructions: `Enter code: ${deviceAuth.userCode}`,
      requestId,
    })
  },
)

providers.get('/openai/oauth/browser/callback', async (c) => {
  const auth = await getAuthorizedOrganization(c)
  const requestId = c.req.query('requestId') || ''
  const pending = requestId ? await getPendingAuth(requestId) : undefined
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const errorDescription = c.req.query('error_description')

  if (!auth.ok) {
    return c.redirect(
      buildOAuthResultRedirect({
        ok: false,
        provider: 'openai',
        requestId,
        error:
          auth.status === 403
            ? 'You no longer have access to this organization.'
            : 'You must be signed in to Surgent to complete this authorization.',
      }),
    )
  }
  const { organizationId } = auth

  if (!pending || pending.method !== 'browser' || pending.organizationId !== organizationId) {
    return c.redirect(
      buildOAuthResultRedirect({
        ok: false,
        provider: 'openai',
        requestId,
        error: 'Authorization request expired or was not found.',
      }),
    )
  }

  if (error) {
    await deletePendingAuth(requestId)
    return c.redirect(
      buildOAuthResultRedirect({
        ok: false,
        provider: 'openai',
        requestId,
        error: errorDescription || error,
      }),
    )
  }
  if (!code || !state || state !== pending.state) {
    await deletePendingAuth(requestId)
    return c.redirect(
      buildOAuthResultRedirect({
        ok: false,
        provider: 'openai',
        requestId,
        error: 'Invalid authorization response.',
      }),
    )
  }

  try {
    const tokens = await exchangeOpenAiAuthorization({
      code,
      redirectUri: pending.redirectUri,
      codeVerifier: pending.codeVerifier,
    })
    await storeOpenAiChatgptCredentials({ organizationId, tokens })
    await deletePendingAuth(requestId)

    return c.redirect(buildOAuthResultRedirect({ ok: true, provider: 'openai', requestId }))
  } catch (err) {
    await deletePendingAuth(requestId)
    const message = err instanceof Error ? err.message : 'Authorization failed.'
    return c.redirect(
      buildOAuthResultRedirect({
        ok: false,
        provider: 'openai',
        requestId,
        error: message,
      }),
    )
  }
})

providers.post(
  '/:provider/oauth/callback',
  zValidator('param', providerParam),
  zValidator('json', oauthCallbackSchema),
  async (c) => {
    const { provider } = c.req.valid('param')
    const { method, requestId } = c.req.valid('json')
    const auth = await getAuthorizedOrganization(c)
    if (!auth.ok) return jsonError(c, auth.error, auth.status)
    const { organizationId } = auth

    if (provider !== 'openai') {
      return jsonError(c, 'OAuth is not supported for this provider yet.', 400)
    }
    if (method !== 0 || !requestId) {
      return jsonError(c, 'Missing pending authorization request.', 400)
    }

    const pending = await getPendingAuth(requestId)
    if (
      !pending ||
      pending.method !== 'device' ||
      pending.organizationId !== organizationId ||
      pending.provider !== 'openai'
    ) {
      return jsonError(c, 'Authorization request expired or was not found.', 400)
    }

    try {
      const device = await pollOpenAiDeviceAuthorization(pending)
      const tokens = await exchangeOpenAiAuthorization({
        code: device.authorization_code,
        redirectUri: `${OPENAI_ISSUER}/deviceauth/callback`,
        codeVerifier: device.code_verifier,
      })

      await storeOpenAiChatgptCredentials({ organizationId, tokens })
      await deletePendingAuth(requestId)

      return c.json(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authorization failed.'
      return jsonError(c, message, 400)
    }
  },
)

providers.get('/', async (c) => {
  const auth = await getAuthorizedOrganization(c)
  if (!auth.ok) return jsonError(c, auth.error, auth.status)
  const { organizationId } = auth

  const rows = await db
    .selectFrom('provider')
    .select(['id', 'provider', 'organizationId', 'createdAt', 'updatedAt'])
    .select('credentials')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .orderBy('createdAt', 'desc')
    .execute()

  return c.json(
    rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      organizationId: row.organizationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authType: getProviderAuthType(row.credentials),
    })),
  )
})

providers.post('/', zValidator('json', providerSchema), async (c) => {
  const auth = await getAuthorizedOrganization(c)
  if (!auth.ok) return jsonError(c, auth.error, auth.status)
  const { organizationId } = auth

  const { provider, credentials } = c.req.valid('json')

  await upsertProviderCredentials({
    organizationId,
    provider,
    credentials,
  })

  return c.json({ updated: true })
})

providers.delete('/:provider', zValidator('param', providerParam), async (c) => {
  const { provider } = c.req.valid('param')
  const auth = await getAuthorizedOrganization(c)
  if (!auth.ok) return jsonError(c, auth.error, auth.status)
  const { organizationId } = auth

  await db
    .deleteFrom('provider')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .execute()

  return c.json({ deleted: true })
})

export default providers
