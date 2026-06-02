import type {
  ParsedWhopWebhookEvent,
  VerifiedWebhookSignature,
  WhopWebhookHeadersInput,
} from './types'

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function asTimestampString(value: unknown): string | undefined {
  const text = asString(value)
  if (text) return text

  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }

  return undefined
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const text = asString(v)
    if (text) return text
  }
  return undefined
}

function firstMinorUnits(...values: unknown[]): number | undefined {
  for (const v of values) {
    const amount = toMinorUnits(v)
    if (amount !== undefined) return amount
  }
  return undefined
}

function firstTimestampString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const ts = asTimestampString(v)
    if (ts) return ts
  }
  return undefined
}

function toMinorUnits(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.round(parsed * 100)
  }
  return undefined
}

function safeEqual(expected: string, candidate: string): boolean {
  if (expected.length !== candidate.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))
}

function decodeWebhookSecret(secret: string): Buffer {
  // Whop's SDK calls btoa(secret) before passing to Standard Webhooks,
  // which then base64-decodes it back — net effect is raw string bytes.
  // Only base64-decode if the secret uses the standard `whsec_` prefix.
  if (secret.startsWith('whsec_')) {
    return Buffer.from(secret.slice(6), 'base64')
  }
  return Buffer.from(secret, 'utf-8')
}

export function composeWhopWebhookSignature(input: WhopWebhookHeadersInput): string {
  const webhookId = asString(input.webhookId || undefined)
  const webhookTimestamp = asString(input.webhookTimestamp || undefined)
  const webhookSignature = asString(input.webhookSignature || undefined)

  if (!webhookSignature) throw new Error('Missing webhook-signature header')

  // Support already-composed "id;timestamp;signatures" input
  if (webhookSignature.includes(';') && !webhookId && !webhookTimestamp) {
    return webhookSignature
  }

  if (!webhookId || !webhookTimestamp) {
    throw new Error('Missing webhook-id or webhook-timestamp header')
  }

  return `${webhookId};${webhookTimestamp};${webhookSignature}`
}

export function verifyWhopWebhookSignature(args: {
  payload: string | Uint8Array
  signature: string
  webhookSecret: string
  toleranceSeconds?: number
}): VerifiedWebhookSignature {
  const parts = args.signature.split(';', 3)
  if (parts.length !== 3) {
    throw new Error("Invalid signature format: expected 'id;timestamp;signatures'")
  }

  const [eventId, timestampRaw, signaturesRaw] = parts
  if (!eventId || !timestampRaw || !signaturesRaw) {
    throw new Error("Invalid signature format: expected 'id;timestamp;signatures'")
  }

  const timestamp = Number.parseInt(timestampRaw, 10)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid webhook timestamp')

  const tolerance = args.toleranceSeconds ?? 300
  const now = Math.floor(Date.now() / 1000)
  if (timestamp > now + tolerance || timestamp < now - tolerance) {
    throw new Error('Webhook timestamp outside tolerance window')
  }

  const payloadText =
    typeof args.payload === 'string' ? args.payload : new TextDecoder().decode(args.payload)
  const signedPayload = `${eventId}.${timestampRaw}.${payloadText}`
  const secretKey = decodeWebhookSecret(args.webhookSecret)
  const expected = new Bun.CryptoHasher('sha256', secretKey).update(signedPayload).digest('base64')

  const valid = signaturesRaw.split(' ').some((entry) => {
    if (!entry.startsWith('v1,')) return false
    return safeEqual(expected, entry.slice(3))
  })

  if (!valid) throw new Error('Invalid webhook signature')

  return { eventId, timestamp }
}

export function parseWhopWebhookEvent(payload: unknown): ParsedWhopWebhookEvent {
  const root = asRecord(payload)
  const eventType = asString(root.type)
  if (!eventType) throw new Error('Missing webhook event type')

  const eventId = asString(root.id)
  const data = asRecord(root.data)
  const metadata = asRecord(data.metadata)
  const sessionId = asString(metadata.session_id)
  const occurredAt = firstTimestampString(root.timestamp, data.created_at)

  const company = asRecord(data.company)
  const user = asRecord(data.user)
  const payment = asRecord(data.payment)
  const membership = asRecord(data.membership)
  const plan = asRecord(data.plan)
  const product = asRecord(data.product)
  const fee = asRecord(data.fee)

  const amount = firstMinorUnits(data.total, data.amount_total, data.amount)
  const amountAfterFees = firstMinorUnits(
    data.amount_after_fees,
    data.amount_after_fee,
    data.net_amount,
  )
  const feeAmount = firstMinorUnits(data.fee_amount, data.application_fee_amount, fee.amount)
  const currency = asString(data.currency)?.toLowerCase()

  // Derive entity IDs based on event type — no wasted pre-assignments
  let paymentId: string | undefined
  let membershipId: string | undefined
  let refundId: string | undefined
  let disputeId: string | undefined
  let invoiceId: string | undefined
  let withdrawalId: string | undefined

  if (eventType.startsWith('payment.')) {
    paymentId = asString(data.id)
  } else if (eventType.startsWith('membership.')) {
    membershipId = asString(data.id)
    paymentId = firstString(payment.id, data.payment_id)
  } else if (eventType.startsWith('refund.')) {
    refundId = asString(data.id)
    paymentId = firstString(payment.id, data.payment_id)
  } else if (eventType.startsWith('dispute.')) {
    disputeId = asString(data.id)
    paymentId = firstString(payment.id, data.payment_id)
  } else if (eventType.startsWith('invoice.')) {
    invoiceId = asString(data.id)
    membershipId = firstString(membership.id, data.membership_id)
  } else if (eventType.startsWith('withdrawal.')) {
    withdrawalId = asString(data.id)
  } else {
    paymentId = firstString(data.id, payment.id, data.payment_id)
  }

  const paymentMethod = asRecord(data.payment_method)
  const card = asRecord(paymentMethod.card)

  return {
    eventId,
    eventType,
    occurredAt,
    sessionId,
    companyId: firstString(company.id, data.company_id),
    amount,
    amountAfterFees,
    feeAmount,
    feeType: firstString(data.fee_type, data.fee_reason, fee.type),
    currency,
    paymentId,
    refundId,
    disputeId,
    invoiceId,
    membershipId,
    withdrawalId,
    status: asString(data.status),
    reason: asString(data.reason),
    userId: asString(user.id),
    userEmail: asString(user.email),
    userName: firstString(user.username, user.name),
    planId: asString(plan.id),
    productId: asString(product.id),
    cancelAtPeriodEnd: asBool(data.cancel_at_period_end),
    renewalPeriodStart: asString(data.renewal_period_start),
    renewalPeriodEnd: asString(data.renewal_period_end),
    canceledAt: asString(data.canceled_at),
    dueAt: firstString(data.due_at, data.due_date),
    paidAt: asString(data.paid_at),
    voidedAt: asString(data.voided_at),
    billingReason: asString(data.billing_reason),
    paymentMethodType: firstString(data.payment_method_type, paymentMethod.payment_method_type),
    cardBrand: firstString(data.card_brand, card.brand),
    cardLast4: firstString(data.card_last4, card.last4),
    failureMessage: asString(data.failure_message),
    metadata,
    data,
  }
}

export function summarizeWhopWebhookEvent(event: ParsedWhopWebhookEvent): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      companyId: event.companyId,
      sessionId: event.sessionId,
      paymentId: event.paymentId,
      refundId: event.refundId,
      disputeId: event.disputeId,
      invoiceId: event.invoiceId,
      membershipId: event.membershipId,
      withdrawalId: event.withdrawalId,
      status: event.status,
      reason: event.reason,
      amount: event.amount,
      amountAfterFees: event.amountAfterFees,
      feeAmount: event.feeAmount,
      feeType: event.feeType,
      currency: event.currency,
      planId: event.planId,
      productId: event.productId,
    }).filter(([, value]) => value !== undefined),
  )
}

function summarizeWhopMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    ['session_id', 'project_id', 'product_id', 'customer_id']
      .map((key) => [key, metadata[key]])
      .filter(([, value]) => typeof value === 'string'),
  )
}

export function redactWhopWebhookEvent(event: ParsedWhopWebhookEvent): ParsedWhopWebhookEvent {
  const metadata = summarizeWhopMetadata(event.metadata)

  return {
    ...event,
    userEmail: undefined,
    userName: undefined,
    cardBrand: undefined,
    cardLast4: undefined,
    failureMessage: undefined,
    metadata,
    data: summarizeWhopWebhookEvent({ ...event, metadata }),
  }
}
