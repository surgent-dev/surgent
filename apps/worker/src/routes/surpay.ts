import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { config } from '@/lib/config'
import { Surpay } from 'surpay'
import { SurpayService } from '@/services/surpay'

const surpay = new Hono<AppContext>()

async function getClientForUser(userId: string) {
  const apiKey = await SurpayService.getOrCreateOrgKey(userId)
  if (!apiKey) return null
  return new Surpay({
    apiKey,
    baseUrl: config.surpay.baseUrl,
  })
}

// POST /connect - Initiate Stripe connect
surpay.post('/connect', requireAuth, async (c) => {
  const user = c.get('user')!
  const client = await getClientForUser(user.id)
  if (!client) return c.json({ error: 'Surpay organization not available' }, 500)
  const { data, error } = await client.accounts.connect({
    processor: 'stripe',
    account_type: 'standard',
    country: 'us',
  })

  if (error) {
    return c.json({ error: error.message || 'Failed to initiate connect' }, 500)
  }

  return c.json(data)
})

// GET /accounts - List connected accounts
surpay.get('/accounts', requireAuth, async (c) => {
  const user = c.get('user')!
  const client = await getClientForUser(user.id)
  if (!client) return c.json({ error: 'Surpay organization not available' }, 500)
  const { data: accounts, error } = await client.accounts.list()

  if (error) {
    return c.json({ error: error.message || 'Failed to list accounts' }, 500)
  }

  return c.json(accounts)
})

// GET /accounts/:accountId - Get single account status
surpay.get('/accounts/:accountId', requireAuth, zValidator('param', z.object({ accountId: z.string() })), async (c) => {
  const user = c.get('user')!
  const client = await getClientForUser(user.id)
  if (!client) return c.json({ error: 'Surpay organization not available' }, 500)
  const { accountId } = c.req.valid('param')
  const { data: account, error } = await client.accounts.get(accountId)

  if (error) {
    return c.json({ error: error.message || 'Failed to get account' }, 404)
  }

  return c.json(account)
})

export default surpay
