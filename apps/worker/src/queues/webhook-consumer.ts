import { getWhopClient } from '@/services/whop'
import {
  claimWebhookEvent,
  getWebhookEventByWebhookId,
  markWebhookEventProcessed,
  markWebhookEventFailed,
  processPaymentSucceeded,
  processPaymentFailed,
} from '@/services/marketplace'

interface WebhookMessage {
  webhookId: string
}

function normalizeWhopEventType(type: string) {
  return type.replaceAll('.', '_')
}

export async function processWebhookBatch(
  batch: MessageBatch<WebhookMessage>,
  env: Env,
  ctx: ExecutionContext
) {
  for (const msg of batch.messages) {
    try {
      await processWebhookEvent(msg.body.webhookId, env)
      msg.ack()
    } catch (err) {
      console.error('[webhook-consumer] failed', {
        webhookId: msg.body.webhookId,
        error: err instanceof Error ? err.message : String(err),
      })
      msg.retry()
    }
  }
}

async function processWebhookEvent(webhookId: string, env: Env) {
  // 1. Try to claim the event atomically
  const claimed = await claimWebhookEvent(webhookId)

  if (!claimed) {
    // Already processed or being processed
    const existing = await getWebhookEventByWebhookId(webhookId)
    if (existing?.status === 'processed' || existing?.status === 'processing') {
      console.log('[webhook-consumer] already handled', { webhookId, status: existing.status })
      return
    }
    // Event doesn't exist or in unexpected state
    throw new Error(`Failed to claim webhook event: ${webhookId}`)
  }

  const { type, payload } = claimed

  try {
    await handleWebhookEvent(type, payload, env)
    await markWebhookEventProcessed(webhookId)
    console.log('[webhook-consumer] processed', { webhookId, type })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await markWebhookEventFailed(webhookId, errorMsg)
    throw err
  }
}

async function handleWebhookEvent(type: string, payload: any, env: Env) {
  const whop = getWhopClient(env)

  const platformFeeBps = parseInt(env.PLATFORM_FEE_BPS || '1000', 10) // default 10%
  const platformFeeFixed = parseInt(env.PLATFORM_FEE_FIXED || '0', 10) // default $0

  const normalizedType = normalizeWhopEventType(type)

  switch (normalizedType) {
    case 'payment_succeeded': {
      const paymentId = payload.data?.id || payload.id
      const orderId = payload.data?.metadata?.orderId || payload.metadata?.orderId

      if (!paymentId || !orderId) {
        console.log('[webhook-consumer] payment_succeeded missing paymentId or orderId', {
          type,
          paymentId,
          orderId,
        })
        return
      }

      await processPaymentSucceeded(
        whop,
        env.PLATFORM_COMPANY_ID,
        paymentId,
        orderId,
        platformFeeBps,
        platformFeeFixed
      )
      break
    }

    case 'payment_failed': {
      const paymentId = payload.data?.id || payload.id
      const orderId = payload.data?.metadata?.orderId || payload.metadata?.orderId

      if (!paymentId || !orderId) {
        console.log('[webhook-consumer] payment_failed missing paymentId or orderId', {
          type,
          paymentId,
          orderId,
        })
        return
      }

      await processPaymentFailed(paymentId, orderId)
      break
    }

    default:
      console.log('[webhook-consumer] unhandled event type', { type, normalizedType })
  }
}
