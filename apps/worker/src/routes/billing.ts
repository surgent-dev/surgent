import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type Stripe from 'stripe'
import type { AppContext } from '@/types/application'
import { requireAuth } from '@/middleware/auth'
import { config } from '@/lib/config'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { enqueueBillingWebhookJob } from '@/lib/billing-queue'
import {
  type BillingSyncKind,
  applyTopupPaymentIntent,
  createBillingCheckout,
  createBillingPortal,
  createTopupPaymentIntent,
  getBillingSnapshot,
  syncStripeCustomerToBillingState,
} from '@/lib/billing'

const billing = new Hono<AppContext>()

const checkoutSchema = z.object({
  interval: z.enum(['month', 'year']),
  requestId: z.string().uuid().optional(),
  returnPath: z.string().trim().min(1).optional(),
})

const topupSchema = z.object({
  amountUsd: z.number().finite().positive(),
  requestId: z.string().uuid().optional(),
  returnPath: z.string().trim().min(1).optional(),
})

const topupConfirmSchema = z.object({
  paymentIntentId: z.string().trim().min(1),
})

const syncSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
})

const portalSchema = z.object({
  returnPath: z.string().trim().min(1).optional(),
})

billing.post('/webhooks/stripe', async (c) => {
  if (!stripe || !config.stripe.webhookSecret) {
    return c.json({ error: 'Stripe webhooks are not configured' }, 503)
  }

  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Missing stripe-signature header' }, 400)

  const body = await c.req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, config.stripe.webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    return c.json({ error: message }, 400)
  }

  const inserted = await db
    .insertInto('billing_event')
    .values({
      stripeEventId: event.id,
      type: event.type,
      payload: event as any,
      status: 'pending',
      error: null,
      receivedAt: new Date(),
      handledAt: null,
    })
    .onConflict((oc) => oc.column('stripeEventId').doNothing())
    .returning('stripeEventId')
    .execute()

  if (!inserted.length) {
    const existing = await db
      .selectFrom('billing_event')
      .select('status')
      .where('stripeEventId', '=', event.id)
      .executeTakeFirst()

    if (existing?.status === 'pending' || existing?.status === 'failed') {
      await enqueueBillingWebhookJob(event.id, event.type, event)
      return c.json({ ok: true, duplicate: true, queued: true }, 202)
    }

    return c.json({ ok: true, duplicate: true })
  }

  try {
    await enqueueBillingWebhookJob(event.id, event.type, event)
    return c.json({ ok: true, queued: true }, 202)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    await db
      .updateTable('billing_event')
      .set({ status: 'failed', error: message, handledAt: new Date() })
      .where('stripeEventId', '=', event.id)
      .execute()
    throw error
  }
})

billing.use('*', requireAuth)

billing.get('/subscription', async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return c.json({ error: 'No active organization' }, 400)

  return c.json(await getBillingSnapshot(organizationId))
})

billing.post('/sync', zValidator('json', syncSchema), async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return c.json({ error: 'No active organization' }, 400)

  const body = c.req.valid('json')
  const kind = await syncStripeCustomerToBillingState({
    organizationId,
    checkoutSessionId: body.sessionId,
  })

  return c.json({
    snapshot: await getBillingSnapshot(organizationId),
    kind,
  })
})

billing.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  const user = c.get('user')
  if (!organizationId || !user) return c.json({ error: 'Unauthorized' }, 401)

  const body = c.req.valid('json')
  try {
    const url = await createBillingCheckout({
      organizationId,
      userId: user.id,
      email: user.email,
      name: user.name,
      interval: body.interval,
      requestId: body.requestId,
      returnPath: body.returnPath,
    })
    return c.json({ url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed'
    return c.json({ error: message }, 400)
  }
})

billing.post('/topups/payment-intent', zValidator('json', topupSchema), async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  const user = c.get('user')
  if (!organizationId || !user) return c.json({ error: 'Unauthorized' }, 401)

  const body = c.req.valid('json')
  try {
    const result = await createTopupPaymentIntent({
      organizationId,
      userId: user.id,
      email: user.email,
      name: user.name,
      amountUsd: body.amountUsd,
      requestId: body.requestId,
      returnPath: body.returnPath,
    })
    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Top-up failed'
    return c.json({ error: message }, 400)
  }
})

billing.post('/topups/confirm', zValidator('json', topupConfirmSchema), async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return c.json({ error: 'No active organization' }, 400)

  const body = c.req.valid('json')
  try {
    const applied = await applyTopupPaymentIntent({
      organizationId,
      paymentIntentId: body.paymentIntentId,
    })
    if (!applied) return c.json({ error: 'Payment is still processing' }, 409)
    await syncStripeCustomerToBillingState({
      organizationId,
    })
    const snapshot = await getBillingSnapshot(organizationId)
    return c.json({ snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Top-up confirmation failed'
    return c.json({ error: message }, 400)
  }
})

billing.post('/portal', zValidator('json', portalSchema), async (c) => {
  const organizationId = c.get('session')?.activeOrganizationId
  if (!organizationId) return c.json({ error: 'No active organization' }, 400)

  try {
    const body = c.req.valid('json')
    const url = await createBillingPortal({ organizationId, returnPath: body.returnPath })
    return c.json({ url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Portal unavailable'
    return c.json({ error: message }, 400)
  }
})

export default billing
