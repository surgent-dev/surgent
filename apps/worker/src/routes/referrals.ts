import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { requireAuth } from '@/middleware/auth'
import { getReferralStats } from '@/lib/referrals'

const referrals = new Hono<AppContext>()

referrals.use('*', requireAuth)

referrals.get('/', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  return c.json(await getReferralStats(user.id))
})

export default referrals
