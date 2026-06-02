import type { Context } from 'hono'
import { HttpError } from '@/lib/errors'
import { authorizePayApiKey, readApiKey } from '@/lib/pay/apikeys'
import { getProjectWithAuth } from '@/services/projects'
import type { AppContext } from '@/types/application'
import type { PayEnv } from '@/lib/pay/types'

type UserLike = { id: string; role?: string | null }

export type AuthResult = {
  userId: string
  mode: 'session' | 'api_key'
  projectId: string | null
  env: PayEnv
}

export async function authorizeRequest(c: Context<AppContext>): Promise<AuthResult> {
  // API key takes priority — we need projectId + env from the apikey row
  if (readApiKey(c.req.raw.headers)) {
    const key = await authorizePayApiKey(c.req.raw.headers)
    if (!key) throw new HttpError(401, 'Invalid API key')
    return { userId: key.userId, mode: 'api_key', projectId: key.projectId, env: key.env }
  }

  // Fall back to session auth (browser/dashboard)
  const user = c.get('user')
  const session = c.get('session')
  if (user && session) {
    const headerEnv = c.req.header('x-pay-env')
    const env: PayEnv = headerEnv === 'test' ? 'test' : 'live'
    return { userId: user.id, mode: 'session', projectId: null, env }
  }

  throw new HttpError(401, 'Unauthorized')
}

export async function authorizeProjectRequest(
  c: Context<AppContext>,
  projectId: string,
  existing?: AuthResult,
): Promise<AuthResult> {
  const auth = existing ?? (await authorizeRequest(c))

  if (auth.mode === 'session') {
    const user = c.get('user')
    if (!user) throw new HttpError(401, 'Unauthorized')
    await getProjectWithAuth(projectId, user as UserLike)
    return auth
  }

  if (!auth.projectId || auth.projectId !== projectId) {
    throw new HttpError(403, 'Forbidden')
  }

  return auth
}

export async function resolveProjectScope(
  c: Context<AppContext>,
  projectId?: string,
): Promise<{ projectId: string; auth: AuthResult }> {
  const auth = await authorizeRequest(c)

  if (projectId) {
    await authorizeProjectRequest(c, projectId, auth)
    return { projectId, auth }
  }

  if (auth.mode === 'api_key' && auth.projectId) {
    return { projectId: auth.projectId, auth }
  }

  throw new HttpError(400, 'projectId query parameter required for session auth')
}
