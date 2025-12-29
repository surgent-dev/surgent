import Whop from '@whop/sdk'

export function getWhopClient(env: Env) {
  return new Whop({
    apiKey: env.WHOP_API_KEY,
    timeout: 30000,
  })
}

export function verifyWebhookSignature(
  payload: string,
  headers: Headers,
  secret: string
): { valid: boolean; event?: unknown } {
  try {
    const whop = new Whop()
    const event = whop.webhooks.unwrap(payload, {
      headers: {
        'webhook-id': headers.get('webhook-id') || '',
        'webhook-timestamp': headers.get('webhook-timestamp') || '',
        'webhook-signature': headers.get('webhook-signature') || '',
      },
      key: secret,
    })

    return { valid: true, event }
  } catch (err) {
    console.error('[whop-webhook] signature verification error:', err)
    return { valid: false }
  }
}

export function getWebhookId(headers: Headers): string | null {
  return headers.get('webhook-id')
}
