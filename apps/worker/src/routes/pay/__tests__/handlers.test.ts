import { describe, test, expect, mock } from 'bun:test'
import type { ParsedWhopWebhookEvent } from '@/lib/pay/types'

const TEST_SECRET = Buffer.from('test-key').toString('base64')
mock.module('@/lib/config', () => ({
  config: {
    whop: {
      test: { webhookSecret: TEST_SECRET, apiKey: 'k', platformCompanyId: 'c', baseUrl: '' },
      live: { webhookSecret: TEST_SECRET, apiKey: 'k', platformCompanyId: 'c', baseUrl: '' },
    },
    database: { url: 'postgres://localhost/test' },
  },
}))
mock.module('@/lib/db', () => ({ db: {} }))

const { resolveEntityLockKey, coerceEvent, verifySignature } = await import('../handlers')

// --- resolveEntityLockKey ---

describe('resolveEntityLockKey', () => {
  const base: ParsedWhopWebhookEvent = {
    eventType: '',
    metadata: {},
    data: {},
  }

  test('payment.* locks on paymentId', () => {
    expect(resolveEntityLockKey('payment.succeeded', { ...base, paymentId: 'pay_1' })).toBe(
      'payment:pay_1',
    )
    expect(resolveEntityLockKey('payment.failed', { ...base, paymentId: 'pay_2' })).toBe(
      'payment:pay_2',
    )
  })

  test('membership.* locks on membershipId', () => {
    expect(resolveEntityLockKey('membership.activated', { ...base, membershipId: 'mem_1' })).toBe(
      'membership:mem_1',
    )
  })

  test('refund.* locks on paymentId (refunds mutate payment graph)', () => {
    expect(resolveEntityLockKey('refund.created', { ...base, paymentId: 'pay_1' })).toBe(
      'payment:pay_1',
    )
  })

  test('dispute.* locks on paymentId', () => {
    expect(resolveEntityLockKey('dispute.created', { ...base, paymentId: 'pay_1' })).toBe(
      'payment:pay_1',
    )
  })

  test('invoice.* locks on membershipId', () => {
    expect(resolveEntityLockKey('invoice.paid', { ...base, membershipId: 'mem_1' })).toBe(
      'membership:mem_1',
    )
  })

  test('withdrawal.* locks on withdrawalId', () => {
    expect(resolveEntityLockKey('withdrawal.created', { ...base, withdrawalId: 'wd_1' })).toBe(
      'withdrawal:wd_1',
    )
  })

  test('verification.* locks on companyId', () => {
    expect(resolveEntityLockKey('verification.succeeded', { ...base, companyId: 'comp_1' })).toBe(
      'company:comp_1',
    )
  })

  test('returns null when entity ID is missing', () => {
    expect(resolveEntityLockKey('payment.succeeded', base)).toBeNull()
    expect(resolveEntityLockKey('membership.activated', base)).toBeNull()
    expect(resolveEntityLockKey('refund.created', base)).toBeNull()
    expect(resolveEntityLockKey('dispute.created', base)).toBeNull()
    expect(resolveEntityLockKey('invoice.paid', base)).toBeNull()
    expect(resolveEntityLockKey('withdrawal.created', base)).toBeNull()
    expect(resolveEntityLockKey('verification.succeeded', base)).toBeNull()
  })

  test('returns null for unknown event types', () => {
    expect(resolveEntityLockKey('unknown.event', { ...base, paymentId: 'pay_1' })).toBeNull()
  })
})

// --- coerceEvent ---

describe('coerceEvent', () => {
  test('parses valid payment event', () => {
    const result = coerceEvent({
      id: 'evt_1',
      type: 'payment.succeeded',
      data: { id: 'pay_1', total: 29.99, currency: 'usd', metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.eventType).toBe('payment.succeeded')
    expect(result.value.paymentId).toBe('pay_1')
    expect(result.value.amount).toBe(2999)
  })

  test('parses valid membership event', () => {
    const result = coerceEvent({
      type: 'membership.activated',
      data: { id: 'mem_1', metadata: {}, user: { id: 'usr_1' } },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.membershipId).toBe('mem_1')
    expect(result.value.userId).toBe('usr_1')
  })

  test('parses refund event with paymentId', () => {
    const result = coerceEvent({
      type: 'refund.created',
      data: { id: 'ref_1', payment_id: 'pay_1', metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.refundId).toBe('ref_1')
    expect(result.value.paymentId).toBe('pay_1')
  })

  test('fails on missing event type', () => {
    const result = coerceEvent({ data: {} })
    expect(result.ok).toBe(false)
  })

  test('parses dispute event', () => {
    const result = coerceEvent({
      type: 'dispute.created',
      data: { id: 'disp_1', payment_id: 'pay_1', metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.disputeId).toBe('disp_1')
    expect(result.value.paymentId).toBe('pay_1')
  })

  test('parses invoice event with membershipId', () => {
    const result = coerceEvent({
      type: 'invoice.paid',
      data: { id: 'inv_1', membership_id: 'mem_1', metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.invoiceId).toBe('inv_1')
    expect(result.value.membershipId).toBe('mem_1')
  })

  test('parses withdrawal event', () => {
    const result = coerceEvent({
      type: 'withdrawal.created',
      data: { id: 'wd_1', amount: 500, currency: 'usd', metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.withdrawalId).toBe('wd_1')
    expect(result.value.amount).toBe(50000)
  })

  test('parses verification event with companyId', () => {
    const result = coerceEvent({
      type: 'verification.succeeded',
      data: { id: 'ver_1', company: { id: 'comp_1' }, metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.companyId).toBe('comp_1')
  })

  test('unknown event type still parses (falls through to default)', () => {
    const result = coerceEvent({
      type: 'foo.bar',
      data: { id: 'x_1', metadata: {} },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.eventType).toBe('foo.bar')
    expect(result.value.paymentId).toBe('x_1') // default branch assigns to paymentId
  })

  test('preserves metadata from data.metadata', () => {
    const result = coerceEvent({
      type: 'payment.succeeded',
      data: {
        id: 'pay_1',
        total: 10,
        currency: 'usd',
        metadata: { project_id: 'proj_1', custom: 'value' },
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.metadata).toEqual({ project_id: 'proj_1', custom: 'value' })
  })

  test('fails on non-object input', () => {
    expect(coerceEvent(null).ok).toBe(false)
    expect(coerceEvent('string').ok).toBe(false)
  })

  test('fails on array input', () => {
    expect(coerceEvent([]).ok).toBe(false)
  })

  test('fails on empty object (no type)', () => {
    expect(coerceEvent({}).ok).toBe(false)
  })
})

// --- verifySignature ---

describe('verifySignature', () => {
  test('missing signature header → statusCode 400', () => {
    const result = verifySignature({ body: '{}', env: 'test' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.statusCode).toBe(400)
    expect(result.error.toLowerCase()).toContain('missing')
  })

  test('missing webhook-id with separate headers → statusCode 400', () => {
    const result = verifySignature({
      body: '{}',
      env: 'test',
      webhookSignature: 'v1,abc',
      webhookTimestamp: '1000000000',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.statusCode).toBe(400)
  })

  test('invalid signature → statusCode 401', () => {
    const result = verifySignature({
      body: '{}',
      env: 'test',
      webhookId: 'evt_1',
      webhookTimestamp: Math.floor(Date.now() / 1000).toString(),
      webhookSignature: 'v1,invalidbase64==',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.statusCode).toBe(401)
  })
})
