import { describe, test, expect } from 'bun:test'
import {
  composeWhopWebhookSignature,
  parseWhopWebhookEvent,
  redactWhopWebhookEvent,
  verifyWhopWebhookSignature,
} from '@/lib/pay/webhooks'

const SECRET = Buffer.from('test-secret-key').toString('base64')
// Production's decodeWebhookSecret treats non-whsec_ secrets as raw UTF-8 bytes
const SECRET_KEY = Buffer.from(SECRET, 'utf-8')

function makeValidSignature(eventId: string, body: string, timestampOverride?: number) {
  const timestamp = timestampOverride ?? Math.floor(Date.now() / 1000)
  const signed = `${eventId}.${timestamp}.${body}`
  const sig = new Bun.CryptoHasher('sha256', SECRET_KEY).update(signed).digest('base64')
  return {
    composed: `${eventId};${timestamp};v1,${sig}`,
    eventId,
    timestamp: timestamp.toString(),
    signature: `v1,${sig}`,
  }
}

// --- composeWhopWebhookSignature ---

describe('composeWhopWebhookSignature', () => {
  test('composes from separate headers', () => {
    const result = composeWhopWebhookSignature({
      webhookId: 'evt_1',
      webhookTimestamp: '1000000000',
      webhookSignature: 'v1,abc',
    })
    expect(result).toBe('evt_1;1000000000;v1,abc')
  })

  test('passes through already-composed format (id;ts;sig)', () => {
    const result = composeWhopWebhookSignature({
      webhookSignature: 'evt_1;1000000000;v1,abc',
    })
    expect(result).toBe('evt_1;1000000000;v1,abc')
  })

  test('throws on missing webhook-signature', () => {
    expect(() => composeWhopWebhookSignature({})).toThrow(/missing/i)
  })

  test('throws on missing webhook-id when timestamp present', () => {
    expect(() =>
      composeWhopWebhookSignature({
        webhookTimestamp: '1000000000',
        webhookSignature: 'v1,abc',
      }),
    ).toThrow(/missing/i)
  })

  test('throws on missing webhook-timestamp when id present', () => {
    expect(() =>
      composeWhopWebhookSignature({
        webhookId: 'evt_1',
        webhookSignature: 'v1,abc',
      }),
    ).toThrow(/missing/i)
  })
})

// --- verifyWhopWebhookSignature ---

describe('verifyWhopWebhookSignature', () => {
  test('valid signature → returns eventId + timestamp', () => {
    const body = '{"type":"payment.succeeded"}'
    const { composed, eventId } = makeValidSignature('evt_valid', body)
    const result = verifyWhopWebhookSignature({
      payload: body,
      signature: composed,
      webhookSecret: SECRET,
    })
    expect(result.eventId).toBe(eventId)
    expect(typeof result.timestamp).toBe('number')
  })

  test('invalid HMAC → throws', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    expect(() =>
      verifyWhopWebhookSignature({
        payload: '{}',
        signature: `evt_bad;${timestamp};v1,totallyWrongSignature==`,
        webhookSecret: SECRET,
      }),
    ).toThrow(/invalid webhook signature/i)
  })

  test('timestamp too old (>5min) → throws', () => {
    const body = '{}'
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600 // 10 min ago
    const { composed } = makeValidSignature('evt_old', body, oldTimestamp)
    expect(() =>
      verifyWhopWebhookSignature({
        payload: body,
        signature: composed,
        webhookSecret: SECRET,
      }),
    ).toThrow(/tolerance/i)
  })

  test('timestamp too far in future (>5min) → throws', () => {
    const body = '{}'
    const futureTimestamp = Math.floor(Date.now() / 1000) + 600 // 10 min ahead
    const { composed } = makeValidSignature('evt_future', body, futureTimestamp)
    expect(() =>
      verifyWhopWebhookSignature({
        payload: body,
        signature: composed,
        webhookSecret: SECRET,
      }),
    ).toThrow(/tolerance/i)
  })

  test('timestamp at edge of tolerance (4min 59s) → passes', () => {
    const body = '{}'
    const edgeTimestamp = Math.floor(Date.now() / 1000) - 299
    const { composed } = makeValidSignature('evt_edge', body, edgeTimestamp)
    const result = verifyWhopWebhookSignature({
      payload: body,
      signature: composed,
      webhookSecret: SECRET,
    })
    expect(result.eventId).toBe('evt_edge')
  })

  test('malformed signature format (no semicolons) → throws', () => {
    expect(() =>
      verifyWhopWebhookSignature({
        payload: '{}',
        signature: 'notsemicolondelimited',
        webhookSecret: SECRET,
      }),
    ).toThrow(/format/i)
  })

  test('wrong secret → throws', () => {
    const body = '{}'
    const { composed } = makeValidSignature('evt_wrongsecret', body)
    expect(() =>
      verifyWhopWebhookSignature({
        payload: body,
        signature: composed,
        webhookSecret: 'wrong-secret',
      }),
    ).toThrow(/invalid webhook signature/i)
  })

  test('multiple signatures — one valid → passes', () => {
    const body = '{}'
    const timestamp = Math.floor(Date.now() / 1000)
    const signed = `evt_multi.${timestamp}.${body}`
    const validSig = new Bun.CryptoHasher('sha256', SECRET_KEY).update(signed).digest('base64')
    // space-separated: first is wrong, second is correct
    const combined = `evt_multi;${timestamp};v1,wrongSig== v1,${validSig}`
    const result = verifyWhopWebhookSignature({
      payload: body,
      signature: combined,
      webhookSecret: SECRET,
    })
    expect(result.eventId).toBe('evt_multi')
  })

  test('v2 prefix signature (unsupported) → throws', () => {
    const body = '{}'
    const timestamp = Math.floor(Date.now() / 1000)
    const signed = `evt_v2.${timestamp}.${body}`
    const sig = new Bun.CryptoHasher('sha256', SECRET_KEY).update(signed).digest('base64')
    expect(() =>
      verifyWhopWebhookSignature({
        payload: body,
        signature: `evt_v2;${timestamp};v2,${sig}`,
        webhookSecret: SECRET,
      }),
    ).toThrow(/invalid webhook signature/i)
  })

  test('Uint8Array payload works same as string', () => {
    const body = '{"hello":"world"}'
    const { composed, eventId } = makeValidSignature('evt_bytes', body)
    const result = verifyWhopWebhookSignature({
      payload: new TextEncoder().encode(body),
      signature: composed,
      webhookSecret: SECRET,
    })
    expect(result.eventId).toBe(eventId)
  })

  test('custom tolerance (10s) rejects 15s-old timestamp', () => {
    const body = '{}'
    const oldTimestamp = Math.floor(Date.now() / 1000) - 15
    const { composed } = makeValidSignature('evt_tight', body, oldTimestamp)
    expect(() =>
      verifyWhopWebhookSignature({
        payload: body,
        signature: composed,
        webhookSecret: SECRET,
        toleranceSeconds: 10,
      }),
    ).toThrow(/tolerance/i)
  })
})

describe('redactWhopWebhookEvent', () => {
  test('keeps routing identifiers and removes customer/card fields', () => {
    const parsed = parseWhopWebhookEvent({
      id: 'evt_1',
      type: 'payment.succeeded',
      data: {
        id: 'pay_1',
        total: 1000,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          session_id: 'session_1',
          project_id: 'project_1',
          product_id: 'product_1',
          customer_id: 'customer_1',
          customer_email: 'customer@example.com',
          custom: 'do-not-store',
        },
        user: {
          id: 'user_1',
          email: 'customer@example.com',
          name: 'Customer Name',
        },
        payment_method: {
          card: {
            brand: 'visa',
            last4: '4242',
          },
        },
      },
    })

    const redacted = redactWhopWebhookEvent(parsed)

    expect(redacted.metadata).toEqual({
      session_id: 'session_1',
      project_id: 'project_1',
      product_id: 'product_1',
      customer_id: 'customer_1',
    })
    expect(redacted.userEmail).toBeUndefined()
    expect(redacted.userName).toBeUndefined()
    expect(redacted.cardBrand).toBeUndefined()
    expect(redacted.cardLast4).toBeUndefined()
    expect(JSON.stringify(redacted)).not.toContain('customer@example.com')
    expect(JSON.stringify(redacted)).not.toContain('4242')
    expect(JSON.stringify(redacted)).not.toContain('do-not-store')
  })
})
