import { Context, Next } from 'hono'
import type { AppContext } from '@/types/application'
import { config } from '@/lib/config'

export function isAdmin(user: { id: string; role?: string | null }): boolean {
  const isAdminById = config.auth.adminUserIds.includes(user.id)
  const isAdminByRole = config.auth.adminRoles.includes(user.role ?? '')
  return isAdminById || isAdminByRole
}

export async function requireAdmin(c: Context<AppContext>, next: Next) {
  const user = c.get('user')
  const session = c.get('session')

  if (!user || !session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!isAdmin(user)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return next()
}
