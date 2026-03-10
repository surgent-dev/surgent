import { Context, Next } from 'hono'
import type { AppContext } from '@/types/application'
import { config } from '@/lib/config'

function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() || ''
}

export function isAdmin(user: {
  id?: string
  email?: string | null
  role?: string | null
}): boolean {
  const email = normalizeEmail(user.email)
  if (!email) return false
  return config.auth.adminUserEmails.includes(email)
}

export async function requireAdmin(c: Context<AppContext>, next: Next) {
  const user = c.get('user')
  const session = c.get('session')

  if (!user || !session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!isAdmin(user)) {
    return c.json({ error: 'Forbidden', email: normalizeEmail(user.email) || null }, 403)
  }

  return next()
}
