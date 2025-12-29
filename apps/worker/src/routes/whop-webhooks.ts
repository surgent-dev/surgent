import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { verifyWebhookSignature, getWebhookId } from '@/services/whop'
import { getWebhookEventByWebhookId, insertWebhookEvent } from '@/services/marketplace'

const whopWebhooks = new Hono<AppContext>()

// POST /api/webhooks/whop - Receive and enqueue Whop webhooks
whopWebhooks.post('/', async (c) => {
  const rawBody = await c.req.text()
  const headers = c.req.raw.headers

  // 1. Verify webhook signature
  const { valid, event } = verifyWebhookSignature(
    rawBody,
    headers,
    c.env.WHOP_WEBHOOK_SECRET
  )

  if (!valid) {
    console.error('[whop-webhook] invalid signature')
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // 2. Extract webhook ID for deduplication
  const webhookId = getWebhookId(headers)
  if (!webhookId) {
    console.error('[whop-webhook] missing webhook-id header')
    return c.json({ error: 'Missing webhook-id' }, 400)
  }

  // 3. Extract event type and company ID
  const eventType = event?.type || 'unknown'
  const whopCompanyId = event?.data?.company_id || event?.company_id

  console.log('[whop-webhook] received', { webhookId, type: eventType })

  // 4. Insert into DB (ON CONFLICT DO NOTHING for dedup)
  const inserted = await insertWebhookEvent({
    webhookId,
    type: eventType,
    whopCompanyId,
    payload: event,
  })

  // 5. If inserted (not a duplicate), enqueue for processing
  if (inserted) {
    await c.env.WHOP_WEBHOOK_QUEUE.send({ webhookId })
    console.log('[whop-webhook] enqueued', { webhookId })
  } else {
    const existing = await getWebhookEventByWebhookId(webhookId)
    if (existing?.status === 'pending' || existing?.status === 'failed') {
      await c.env.WHOP_WEBHOOK_QUEUE.send({ webhookId })
      console.log('[whop-webhook] duplicate, re-enqueued', { webhookId, status: existing.status })
    } else {
      console.log('[whop-webhook] duplicate, skipped', { webhookId, status: existing?.status })
    }
  }

  // 6. Return 200 immediately
  return c.json({ received: true })
})

export default whopWebhooks
