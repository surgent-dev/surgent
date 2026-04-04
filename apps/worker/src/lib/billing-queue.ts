import type Stripe from 'stripe'
import type { Job } from 'pg-boss'
import { db } from '@/lib/db'
import { getBoss } from '@/lib/boss'
import { createLogger } from '@/lib/logger'
import {
  applyTopupPaymentIntent,
  findOrganizationIdByStripeCustomerId,
  refundBillingPayment,
  syncBillingPaymentFromInvoice,
  syncBillingPaymentMethodFromCustomer,
  syncStripeCustomerToBillingState,
} from '@/lib/billing'

const log = createLogger('pg-boss')

const QUEUE_NAME = 'billing.webhook.process'
const DLQ_NAME = 'billing.webhook.dead'

type BillingWebhookJob = {
  eventId: string
  eventType: string
  event: Stripe.Event
}

let registered = false

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Billing webhook handling failed'
}

function isPermanentBillingError(err: unknown) {
  if (!err || typeof err !== 'object') return false

  const code = 'code' in err && typeof err.code === 'string' ? err.code : null
  const statusCode =
    'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : null
  const status = 'status' in err && typeof err.status === 'number' ? err.status : statusCode
  const message = err instanceof Error ? err.message : ''

  if (code === '22P02' || code === '42P18') return true
  // TODO: Make unknown Stripe prices retryable once legacy price resolution is implemented.
  if (message.startsWith('Unknown Stripe price ID:')) return true
  if (message.startsWith('Unknown billing tier:')) return true
  if (message.startsWith('Unknown top-up')) return true
  if (message === 'Checkout session does not belong to this organization') return true
  if (status && status >= 400 && status < 500 && ![408, 409, 429].includes(status)) return true

  return false
}

async function processStripeWebhookEvent(eventId: string, eventType: string, event: Stripe.Event) {
  const claimed = await db
    .updateTable('billing_event')
    .set({ status: 'processing', error: null })
    .where('stripeEventId', '=', eventId)
    .where('status', 'in', ['pending', 'failed'])
    .returning('stripeEventId')
    .executeTakeFirst()

  if (!claimed) {
    log.debug({ eventId }, `[QUEUE:billing] ${eventType} skipped (already claimed)`)
    return
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    const organizationId =
      session.metadata?.organizationId ??
      (customerId ? await findOrganizationIdByStripeCustomerId(customerId) : null)

    if (organizationId && session.mode === 'payment' && session.payment_status === 'paid') {
      await syncStripeCustomerToBillingState({
        organizationId,
        stripeCustomerId: customerId,
        checkoutSessionId: session.id,
      })
    }

    if (organizationId && session.mode !== 'payment') {
      await syncStripeCustomerToBillingState({
        organizationId,
        stripeCustomerId: customerId,
      })
    }

    return
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object
    if (paymentIntent.metadata?.kind !== 'topup') return

    const customerId =
      typeof paymentIntent.customer === 'string'
        ? paymentIntent.customer
        : paymentIntent.customer?.id
    const organizationId =
      paymentIntent.metadata?.organizationId ??
      (customerId ? await findOrganizationIdByStripeCustomerId(customerId) : null)
    if (!organizationId) return

    await applyTopupPaymentIntent({
      organizationId,
      paymentIntentId: paymentIntent.id,
      stripeEventId: event.id,
    })
    return
  }

  // Handle default payment method changes from the Stripe portal.
  // Only sync PM when invoice_settings.default_payment_method actually changed.
  if (event.type === 'customer.updated') {
    const prev = (event.data as any).previous_attributes?.invoice_settings ?? {}
    if (!('default_payment_method' in prev)) return

    const customerId = event.data.object.id
    const paymentMethodId = (event.data.object as any).invoice_settings?.default_payment_method
    if (!customerId) return

    await syncBillingPaymentMethodFromCustomer({
      stripeCustomerId: customerId,
      paymentMethodId,
    })
    return
  }

  if (
    event.type === 'checkout.session.async_payment_failed' ||
    event.type === 'invoice.paid' ||
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.payment_action_required' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.trial_will_end'
  ) {
    const object = event.data.object as { customer?: string | null; id?: string | null }
    const customerId = object.customer
    if (!customerId) return

    const organizationId = await findOrganizationIdByStripeCustomerId(customerId)
    if (!organizationId) return

    await syncStripeCustomerToBillingState({
      organizationId,
      stripeCustomerId: customerId,
    })

    if (
      (event.type === 'invoice.paid' ||
        event.type === 'invoice.payment_failed' ||
        event.type === 'invoice.payment_action_required') &&
      object.id
    ) {
      await syncBillingPaymentFromInvoice({
        organizationId,
        invoiceId: object.id,
        status:
          event.type === 'invoice.paid'
            ? 'paid'
            : event.type === 'invoice.payment_failed'
              ? 'failed'
              : 'action_required',
      })
    }

    return
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object
    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
    if (!customerId || !paymentIntentId) return

    const organizationId = await findOrganizationIdByStripeCustomerId(customerId)
    if (!organizationId) return

    await refundBillingPayment({
      organizationId,
      stripePaymentIntentId: paymentIntentId,
      refundedAmountMicros: Math.round((charge.amount_refunded ?? 0) * 1_000_000),
      refundedAt: new Date(event.created * 1000),
      stripeEventId: event.id,
    })
  }
}

export async function registerBillingWorkers(): Promise<void> {
  if (registered) return

  const boss = getBoss()

  await boss.createQueue(DLQ_NAME, {
    retentionSeconds: 2_592_000,
  })

  await boss.createQueue(QUEUE_NAME, {
    retryLimit: 5,
    retryBackoff: true,
    expireInSeconds: 600,
    retentionSeconds: 604800,
    deadLetter: DLQ_NAME,
  })

  await boss.work<BillingWebhookJob>(
    QUEUE_NAME,
    { pollingIntervalSeconds: 2 },
    async (jobs: Job<BillingWebhookJob>[]) => {
      for (const job of jobs) {
        const { eventId, eventType, event } = job.data

        try {
          await processStripeWebhookEvent(eventId, eventType, event)
          await db
            .updateTable('billing_event')
            .set({ status: 'handled', handledAt: new Date(), error: null })
            .where('stripeEventId', '=', eventId)
            .execute()
          log.info({ eventId, jobId: job.id }, `[QUEUE:billing] ${eventType} completed`)
        } catch (err) {
          const message = getErrorMessage(err)
          if (isPermanentBillingError(err)) {
            await db
              .updateTable('billing_event')
              .set({ status: 'failed', handledAt: new Date(), error: message })
              .where('stripeEventId', '=', eventId)
              .execute()
            log.error(
              { eventId, jobId: job.id, err },
              `[QUEUE:billing] ${eventType} failed permanently`,
            )
            continue
          }

          await db
            .updateTable('billing_event')
            .set({ status: 'failed', error: message })
            .where('stripeEventId', '=', eventId)
            .execute()
          log.error({ eventId, jobId: job.id, err }, `[QUEUE:billing] ${eventType} failed`)
          throw err
        }
      }
    },
  )

  await boss.work<BillingWebhookJob>(
    DLQ_NAME,
    { pollingIntervalSeconds: 30 },
    async (jobs: Job<BillingWebhookJob>[]) => {
      for (const job of jobs) {
        const current = await db
          .selectFrom('billing_event')
          .select('error')
          .where('stripeEventId', '=', job.data.eventId)
          .executeTakeFirst()

        await db
          .updateTable('billing_event')
          .set({
            status: 'failed',
            handledAt: new Date(),
            error: current?.error || 'Exhausted all retries',
          })
          .where('stripeEventId', '=', job.data.eventId)
          .execute()

        log.error(
          { eventId: job.data.eventId, jobId: job.id },
          `[QUEUE:billing] ${job.data.eventType} exhausted retries`,
        )
      }
    },
  )

  registered = true
  log.info({ queues: [QUEUE_NAME, DLQ_NAME] }, 'billing workers registered')
}

export async function enqueueBillingWebhookJob(
  eventId: string,
  eventType: string,
  event: Stripe.Event,
) {
  return getBoss().send(QUEUE_NAME, { eventId, eventType, event }, { singletonKey: eventId })
}
