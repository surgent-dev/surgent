import { db } from '@/lib/db'
import { config } from '@/lib/config'
import {
  composeWhopWebhookSignature,
  parseWhopWebhookEvent,
  summarizeWhopWebhookEvent,
  verifyWhopWebhookSignature,
} from '@/lib/pay/webhooks'
import type { ParsedWhopWebhookEvent, PayEnv } from '@/lib/pay/types'
import {
  toDate,
  extractProjectId,
  resolvePaymentStatus,
  resolveCheckoutStatus,
  resolveSubscriptionStatus,
  resolveRefundStatus,
  resolveDisputeStatus,
  resolveInvoiceStatus,
  getClient,
} from '@/lib/pay/utils'
import { sql } from 'kysely'
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '@repo/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('webhook')

type Trx = Kysely<Database> | Transaction<Database>

// Strip null/undefined — on UPDATE, skipped fields keep their existing DB value
function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as Partial<T>
}

function eventSummary(event: ParsedWhopWebhookEvent): Record<string, unknown> {
  return summarizeWhopWebhookEvent(event)
}

async function resolveProjectId(
  trx: Trx,
  projectId: string | null | undefined,
): Promise<string | null> {
  if (!projectId) return null

  const project = await trx
    .selectFrom('project')
    .select('id')
    .where('id', '=', projectId)
    .executeTakeFirst()
  if (project?.id) return project.id

  log.warn({ projectId }, 'ignoring webhook metadata for missing project')
  return null
}

// --- Status lookup tables ---

const paymentStatuses: Record<string, string> = {
  'payment.succeeded': 'succeeded',
  'payment.failed': 'failed',
  'payment.pending': 'pending',
  'payment.created': 'created',
}

const checkoutStatuses: Record<string, string> = {
  'payment.succeeded': 'completed',
  'payment.failed': 'failed',
  'payment.pending': 'pending',
}

const invoiceStatuses: Record<string, string> = {
  'invoice.created': 'open',
  'invoice.paid': 'paid',
  'invoice.past_due': 'past_due',
  'invoice.voided': 'voided',
}

function statusFromPayment(eventType: string, fallback = 'processing'): string {
  return paymentStatuses[eventType] ?? fallback
}

function statusFromCheckout(eventType: string): string {
  return checkoutStatuses[eventType] ?? 'open'
}

function statusFromRefund(eventType: string, fallback?: string): string {
  return fallback ?? (eventType === 'refund.created' ? 'pending' : 'updated')
}

function statusFromDispute(eventType: string, fallback?: string): string {
  return fallback ?? (eventType === 'dispute.created' ? 'open' : 'updated')
}

function statusFromInvoice(eventType: string, fallback?: string): string {
  return fallback ?? invoiceStatuses[eventType] ?? 'open'
}

function statusFromWithdrawal(eventType: string, fallback?: string): string {
  return fallback ?? (eventType === 'withdrawal.created' ? 'pending' : 'updated')
}

// --- Transaction ledger ---

type TransactionKind =
  | 'payment'
  | 'processor_fee'
  | 'refund'
  | 'refund_reversal'
  | 'dispute'
  | 'dispute_reversal'
  | 'balance'
  | 'payout'
  | 'invoice'

type TransactionDirection = 'inflow' | 'outflow' | 'neutral'

const kindDirections: Record<string, TransactionDirection> = {
  payment: 'inflow',
  refund_reversal: 'inflow',
  dispute_reversal: 'inflow',
  refund: 'outflow',
  dispute: 'outflow',
  processor_fee: 'outflow',
  payout: 'outflow',
}

function directionForKind(kind: TransactionKind): TransactionDirection {
  return kindDirections[kind] ?? 'neutral'
}

interface UpsertTransactionArgs {
  kind: TransactionKind
  direction?: TransactionDirection
  processor?: string
  accountId?: string | null
  processorFeeType?: string | null
  sourceId?: string
  projectId: string | null
  checkoutId?: string | null
  paymentId?: string | null
  subscriptionId?: string | null
  invoiceId?: string | null
  paymentTransactionId?: string | null
  incurredByTransactionId?: string | null
  payoutTransactionId?: string | null
  status?: string | null
  amount?: number
  currency?: string
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
  happenedAt?: Date | null
  env: PayEnv
}

async function upsertTransaction(args: UpsertTransactionArgs, trx: Trx = db) {
  if (!args.sourceId) return null

  const now = new Date()
  const direction = args.direction || directionForKind(args.kind)
  const currency = (args.currency || 'usd').toLowerCase()

  const state = {
    status: args.status || null,
    amount: args.amount ?? 0,
    currency,
    direction,
    processorFeeType: args.processorFeeType || null,
    happenedAt: args.happenedAt || null,
    metadata: args.metadata,
    raw: args.raw,
  }
  const linking = {
    projectId: args.projectId,
    accountId: args.accountId || null,
    checkoutId: args.checkoutId || null,
    paymentId: args.paymentId || null,
    subscriptionId: args.subscriptionId || null,
    invoiceId: args.invoiceId || null,
    paymentTransactionId: args.paymentTransactionId || null,
    incurredByTransactionId: args.incurredByTransactionId || null,
    payoutTransactionId: args.payoutTransactionId || null,
  }

  const row = await trx
    .insertInto('pay_transaction')
    .values({
      kind: args.kind,
      processor: args.processor || 'whop',
      sourceId: args.sourceId,
      ...state,
      ...linking,
      env: args.env,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['kind', 'sourceId', 'env']).doUpdateSet({
        ...state,
        ...defined(linking),
        updatedAt: now,
      }),
    )
    .returning(['id', 'accountId'])
    .executeTakeFirst()

  return row ?? null
}

async function getPaymentTransaction(paymentId: string | undefined, env: PayEnv, trx: Trx = db) {
  if (!paymentId) return null
  return (
    (await trx
      .selectFrom('pay_transaction')
      .select(['id', 'accountId'])
      .where('kind', '=', 'payment')
      .where('sourceId', '=', paymentId)
      .where('env', '=', env)
      .executeTakeFirst()) ?? null
  )
}

async function lookupAccount(companyId: string | undefined, env: PayEnv, trx: Trx) {
  if (!companyId) return null
  return (
    (await trx
      .selectFrom('pay_account')
      .select(['id'])
      .where('whopCompanyId', '=', companyId)
      .where('env', '=', env)
      .executeTakeFirst()) ?? null
  )
}

// --- Fee resolution ---

interface ResolvedFee {
  sourceId: string
  type: string
  amount: number
  currency: string
  name?: string
}

async function resolvePaymentFees(
  paymentId: string,
  env: PayEnv,
  ev: ParsedWhopWebhookEvent,
): Promise<ResolvedFee[]> {
  // Try itemised fees from Whop API
  try {
    const client = getClient(env)
    const raw = await client.listPaymentFees(paymentId)
    const itemised = raw
      .filter((f) => f.amount > 0)
      .map((f, i) => ({
        sourceId: `${paymentId}:fee:${i}:${f.type}`,
        type: f.type || 'processing',
        amount: Math.round(f.amount * 100),
        currency: (f.currency || ev.currency || 'usd').toLowerCase(),
        name: f.name,
      }))
    if (itemised.length > 0) return itemised
  } catch (err) {
    log.warn({ paymentId, err }, 'fee list fetch failed, using aggregate')
  }

  // Fallback: aggregate from webhook payload
  const feeAmount =
    ev.feeAmount !== undefined
      ? Math.max(ev.feeAmount, 0)
      : ev.amountAfterFees !== undefined
        ? Math.max((ev.amount ?? 0) - ev.amountAfterFees, 0)
        : 0

  if (feeAmount > 0) {
    return [
      {
        sourceId: `${paymentId}:processor_fee`,
        type: ev.feeType || 'processing',
        amount: feeAmount,
        currency: ev.currency || 'usd',
      },
    ]
  }

  return []
}

// --- Customer upsert ---

async function upsertCustomer(
  trx: Trx,
  projectId: string,
  externalId: string | null,
  email: string | null,
  name: string | null,
  env: PayEnv,
  processorCustomerId?: string | null,
): Promise<string | null> {
  if (!externalId && !email) return null
  const now = new Date()

  // When externalId is a Whop ID (same as processorCustomerId), check if a customer
  // already exists with that processorCustomerId under a different (app-provided) externalId.
  // This prevents creating a duplicate row when the same person pays via SDK (has app ID)
  // and later via dashboard (no app ID, falls back to Whop ID).
  if (externalId && processorCustomerId && externalId === processorCustomerId) {
    const byProcessor = await trx
      .selectFrom('pay_customer')
      .select(['id', 'externalId'])
      .where('projectId', '=', projectId)
      .where('processorCustomerId', '=', processorCustomerId)
      .where('env', '=', env)
      .executeTakeFirst()

    if (byProcessor) {
      await trx
        .updateTable('pay_customer')
        .set({
          ...(email ? { email } : {}),
          ...(name ? { name } : {}),
          updatedAt: now,
        })
        .where('id', '=', byProcessor.id)
        .execute()
      return byProcessor.id
    }
  }

  if (externalId) {
    const row = await trx
      .insertInto('pay_customer')
      .values({
        projectId,
        externalId,
        processorCustomerId: processorCustomerId || null,
        email,
        name,
        metadata: {},
        env,
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((oc) =>
        oc.columns(['projectId', 'externalId', 'env']).doUpdateSet({
          email: email || undefined,
          name: name || undefined,
          ...(processorCustomerId ? { processorCustomerId } : {}),
          updatedAt: now,
        }),
      )
      .returning('id')
      .executeTakeFirst()
    return row?.id ?? null
  }

  // Email-only: find existing or create
  const existing = await trx
    .selectFrom('pay_customer')
    .select('id')
    .where('projectId', '=', projectId)
    .where('email', '=', email!)
    .where('env', '=', env)
    .executeTakeFirst()

  if (existing) {
    await trx
      .updateTable('pay_customer')
      .set({
        ...(name ? { name } : {}),
        ...(processorCustomerId ? { processorCustomerId } : {}),
        updatedAt: now,
      })
      .where('id', '=', existing.id)
      .execute()
    return existing.id
  }

  const row = await trx
    .insertInto('pay_customer')
    .values({
      projectId,
      externalId: null,
      processorCustomerId: processorCustomerId || null,
      email,
      name,
      metadata: {},
      env,
      createdAt: now,
      updatedAt: now,
    })
    .returning('id')
    .executeTakeFirst()
  return row?.id ?? null
}

// --- Webhook event processing ---

export function coerceEvent(payload: unknown) {
  try {
    return { ok: true as const, value: parseWhopWebhookEvent(payload) }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Invalid webhook event',
    }
  }
}

export function verifySignature(input: {
  body: string
  env: PayEnv
  webhookId?: string | null
  webhookTimestamp?: string | null
  webhookSignature?: string | null
}) {
  const webhookSecret = config.whop[input.env].webhookSecret
  if (!webhookSecret) {
    return {
      ok: false as const,
      error: 'Whop webhook secret not configured',
      statusCode: 500 as const,
    }
  }

  try {
    const signature = composeWhopWebhookSignature({
      webhookId: input.webhookId,
      webhookTimestamp: input.webhookTimestamp,
      webhookSignature: input.webhookSignature,
    })
    return {
      ok: true as const,
      value: verifyWhopWebhookSignature({
        payload: input.body,
        signature,
        webhookSecret,
      }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    const isMissingHeader = message.toLowerCase().includes('missing')
    return {
      ok: false as const,
      error: message,
      statusCode: (isMissingHeader ? 400 : 401) as 400 | 401,
    }
  }
}

// --- Individual event handlers ---

async function upsertPaymentFromWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.paymentId) return

  const metadataProjectId = await resolveProjectId(trx, extractProjectId(ev.metadata))

  const checkout = ev.sessionId
    ? await trx
        .selectFrom('pay_checkout_session')
        .select(['id', 'projectId', 'accountId', 'whopCompanyId', 'status', 'completedAt'])
        .where('id', '=', ev.sessionId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const account =
    !checkout?.projectId && !metadataProjectId ? await lookupAccount(ev.companyId, env, trx) : null
  const projectId = checkout?.projectId || metadataProjectId || null
  const accountId = checkout?.accountId || account?.id || null
  const checkoutId = checkout?.id || null
  const whopCompanyId = checkout?.whopCompanyId || null
  const happenedAt = toDate(ev.occurredAt) || new Date()
  const now = new Date()
  const existingPayment = await trx
    .selectFrom('pay_payment')
    .select(['status'])
    .where('whopPaymentId', '=', ev.paymentId)
    .where('env', '=', env)
    .executeTakeFirst()
  const status = resolvePaymentStatus(existingPayment?.status, statusFromPayment(eventType))
  const paymentMetadata = {
    ...ev.metadata,
    ...(ev.userId ? { user_id: ev.userId } : {}),
  }

  // Prefer app's customer ID from checkout metadata over Whop user ID
  const appCustomerId =
    typeof ev.metadata?.customer_id === 'string' ? ev.metadata.customer_id : null
  const customerId =
    projectId && (appCustomerId || ev.userId || ev.userEmail)
      ? await upsertCustomer(
          trx,
          projectId,
          appCustomerId || ev.userId || null,
          ev.userEmail || null,
          ev.userName || null,
          env,
          ev.userId || null,
        )
      : null

  const linking = { projectId, checkoutId, whopCompanyId, customerId }

  const paymentDetails = {
    paidAt: toDate(ev.paidAt),
    billingReason: ev.billingReason || null,
    paymentMethodType: ev.paymentMethodType || null,
    cardBrand: ev.cardBrand || null,
    cardLast4: ev.cardLast4 || null,
    failureMessage: ev.failureMessage || null,
  }

  await trx
    .insertInto('pay_payment')
    .values({
      whopPaymentId: ev.paymentId,
      ...linking,
      ...paymentDetails,
      amount: ev.amount ?? 0,
      currency: ev.currency || 'usd',
      status,
      whopUserId: ev.userId || null,
      customerEmail: ev.userEmail || null,
      customerName: ev.userName || null,
      metadata: paymentMetadata,
      raw: eventSummary(ev),
      env,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['whopPaymentId', 'env']).doUpdateSet({
        status,
        amount: ev.amount ?? 0,
        currency: ev.currency || 'usd',
        whopUserId: ev.userId || undefined,
        customerEmail: ev.userEmail || null,
        customerName: ev.userName || null,
        ...paymentDetails,
        metadata: paymentMetadata,
        raw: eventSummary(ev),
        ...defined(linking),
        updatedAt: now,
      }),
    )
    .execute()

  const payment = await trx
    .selectFrom('pay_payment')
    .select(['id', 'checkoutId'])
    .where('whopPaymentId', '=', ev.paymentId)
    .where('env', '=', env)
    .executeTakeFirst()

  if (eventType === 'payment.succeeded') {
    const resolvedAccountId =
      accountId ||
      (payment?.checkoutId
        ? (
            await trx
              .selectFrom('pay_checkout_session')
              .select('accountId')
              .where('id', '=', payment.checkoutId)
              .where('env', '=', env)
              .executeTakeFirst()
          )?.accountId
        : null) ||
      null

    const paymentTx = await upsertTransaction(
      {
        kind: 'payment',
        sourceId: ev.paymentId,
        projectId,
        accountId: resolvedAccountId,
        checkoutId: payment?.checkoutId || checkoutId,
        paymentId: payment?.id || null,
        status,
        amount: ev.amount ?? 0,
        currency: ev.currency || 'usd',
        metadata: paymentMetadata,
        raw: eventSummary(ev),
        happenedAt,
        env,
      },
      trx,
    )

    // Record processor fees
    const fees = await resolvePaymentFees(ev.paymentId!, env, ev)
    for (const fee of fees) {
      await upsertTransaction(
        {
          kind: 'processor_fee',
          sourceId: fee.sourceId,
          projectId,
          accountId: resolvedAccountId,
          checkoutId: payment?.checkoutId || checkoutId,
          paymentId: payment?.id || null,
          paymentTransactionId: paymentTx?.id || null,
          incurredByTransactionId: paymentTx?.id || null,
          processorFeeType: fee.type,
          status: 'succeeded',
          amount: fee.amount,
          currency: fee.currency,
          metadata: { ...paymentMetadata, ...(fee.name ? { fee_name: fee.name } : {}) },
          raw: eventSummary(ev),
          happenedAt,
          env,
        },
        trx,
      )
    }
  }

  if (checkout?.id) {
    const nextCheckoutStatus = resolveCheckoutStatus(checkout.status, statusFromCheckout(eventType))
    await trx
      .updateTable('pay_checkout_session')
      .set({
        status: nextCheckoutStatus,
        completedAt:
          nextCheckoutStatus === 'completed' ? checkout.completedAt || now : checkout.completedAt,
        updatedAt: now,
      })
      .where('id', '=', checkout.id)
      .execute()
  }
}

async function upsertMembershipFromWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.membershipId) return

  const metadataProjectId = await resolveProjectId(trx, extractProjectId(ev.metadata))

  const existingSub = await trx
    .selectFrom('pay_subscription')
    .select('status')
    .where('whopMembershipId', '=', ev.membershipId)
    .where('env', '=', env)
    .executeTakeFirst()

  const checkout = ev.sessionId
    ? await trx
        .selectFrom('pay_checkout_session')
        .select(['id', 'projectId'])
        .where('id', '=', ev.sessionId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const account =
    !checkout?.projectId && !metadataProjectId ? await lookupAccount(ev.companyId, env, trx) : null
  const projectId = checkout?.projectId || metadataProjectId || null
  const checkoutId = checkout?.id || null
  const now = new Date()
  const rawStatus =
    eventType === 'membership.deactivated' ? ev.status || 'canceled' : ev.status || 'active'
  const status = resolveSubscriptionStatus(existingSub?.status, rawStatus)
  const periodStart = toDate(ev.renewalPeriodStart)
  const periodEnd = toDate(ev.renewalPeriodEnd)
  const canceledAt = toDate(ev.canceledAt)

  const appCustomerIdSub =
    typeof ev.metadata?.customer_id === 'string' ? ev.metadata.customer_id : null
  const customerId =
    projectId && (appCustomerIdSub || ev.userId || ev.userEmail)
      ? await upsertCustomer(
          trx,
          projectId,
          appCustomerIdSub || ev.userId || null,
          ev.userEmail || null,
          ev.userName || null,
          env,
          ev.userId || null,
        )
      : null

  const linking = {
    projectId,
    checkoutId,
    customerId,
    whopPlanId: ev.planId || null,
    whopProductId: ev.productId || null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    canceledAt,
  }

  await trx
    .insertInto('pay_subscription')
    .values({
      whopMembershipId: ev.membershipId,
      ...linking,
      whopUserId: ev.userId || null,
      status,
      cancelAtPeriodEnd: ev.cancelAtPeriodEnd || false,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      env,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['whopMembershipId', 'env']).doUpdateSet({
        status,
        whopUserId: ev.userId || null,
        cancelAtPeriodEnd: ev.cancelAtPeriodEnd || false,
        metadata: ev.metadata,
        raw: eventSummary(ev),
        ...defined(linking),
        updatedAt: now,
      }),
    )
    .execute()
}

async function upsertRefundFromWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.refundId) return

  const metadataProjectId = await resolveProjectId(trx, extractProjectId(ev.metadata))

  const payment = ev.paymentId
    ? await trx
        .selectFrom('pay_payment')
        .select(['id', 'projectId', 'checkoutId', 'currency'])
        .where('whopPaymentId', '=', ev.paymentId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const projectId = payment?.projectId || metadataProjectId || null
  const paymentId = payment?.id || null
  const paymentTx = await getPaymentTransaction(ev.paymentId, env, trx)
  const checkout = payment?.checkoutId
    ? await trx
        .selectFrom('pay_checkout_session')
        .select(['accountId'])
        .where('id', '=', payment.checkoutId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null
  const now = new Date()
  const happenedAt = toDate(ev.occurredAt) || now
  const existingRefund = await trx
    .selectFrom('pay_refund')
    .select('status')
    .where('whopRefundId', '=', ev.refundId)
    .where('env', '=', env)
    .executeTakeFirst()
  const status = resolveRefundStatus(existingRefund?.status, statusFromRefund(eventType, ev.status))
  const currency = (ev.currency || payment?.currency || 'usd').toLowerCase()
  const amount = ev.amount ?? 0

  const linking = { projectId, paymentId }

  await trx
    .insertInto('pay_refund')
    .values({
      whopRefundId: ev.refundId,
      ...linking,
      status,
      amount,
      currency,
      reason: ev.reason || null,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      env,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['whopRefundId', 'env']).doUpdateSet({
        status,
        amount,
        currency,
        reason: ev.reason || null,
        metadata: ev.metadata,
        raw: eventSummary(ev),
        ...defined(linking),
        updatedAt: now,
      }),
    )
    .execute()

  await upsertTransaction(
    {
      kind: 'refund',
      sourceId: ev.refundId,
      projectId,
      accountId: checkout?.accountId || paymentTx?.accountId || null,
      checkoutId: payment?.checkoutId || null,
      paymentId,
      paymentTransactionId: paymentTx?.id || null,
      status,
      amount,
      currency,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      happenedAt,
      env,
    },
    trx,
  )
}

async function upsertDisputeFromWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.disputeId) return

  const metadataProjectId = await resolveProjectId(trx, extractProjectId(ev.metadata))

  const payment = ev.paymentId
    ? await trx
        .selectFrom('pay_payment')
        .select(['id', 'projectId', 'checkoutId', 'currency'])
        .where('whopPaymentId', '=', ev.paymentId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const projectId = payment?.projectId || metadataProjectId || null
  const paymentId = payment?.id || null
  const paymentTx = await getPaymentTransaction(ev.paymentId, env, trx)
  const checkout = payment?.checkoutId
    ? await trx
        .selectFrom('pay_checkout_session')
        .select(['accountId'])
        .where('id', '=', payment.checkoutId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null
  const now = new Date()
  const happenedAt = toDate(ev.occurredAt) || now
  const existingDispute = await trx
    .selectFrom('pay_dispute')
    .select('status')
    .where('whopDisputeId', '=', ev.disputeId)
    .where('env', '=', env)
    .executeTakeFirst()
  const status = resolveDisputeStatus(
    existingDispute?.status,
    statusFromDispute(eventType, ev.status),
  )
  const currency = (ev.currency || payment?.currency || 'usd').toLowerCase()
  const amount = ev.amount ?? 0
  const resolved = status === 'won' || status === 'lost' || status === 'closed'

  const linking = { projectId, paymentId }

  await trx
    .insertInto('pay_dispute')
    .values({
      whopDisputeId: ev.disputeId,
      ...linking,
      status,
      amount,
      currency,
      reason: ev.reason || null,
      resolvedAt: resolved ? now : null,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      env,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['whopDisputeId', 'env']).doUpdateSet({
        status,
        amount,
        currency,
        reason: ev.reason || null,
        ...(resolved && { resolvedAt: now }),
        metadata: ev.metadata,
        raw: eventSummary(ev),
        ...defined(linking),
        updatedAt: now,
      }),
    )
    .execute()

  await upsertTransaction(
    {
      kind: 'dispute',
      sourceId: ev.disputeId,
      projectId,
      accountId: checkout?.accountId || paymentTx?.accountId || null,
      checkoutId: payment?.checkoutId || null,
      paymentId,
      paymentTransactionId: paymentTx?.id || null,
      status,
      amount,
      currency,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      happenedAt,
      env,
    },
    trx,
  )
}

async function upsertInvoiceFromWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.invoiceId) return

  const metadataProjectId = await resolveProjectId(trx, extractProjectId(ev.metadata))

  const checkout = ev.sessionId
    ? await trx
        .selectFrom('pay_checkout_session')
        .select(['id', 'projectId', 'accountId'])
        .where('id', '=', ev.sessionId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const subscription = ev.membershipId
    ? await trx
        .selectFrom('pay_subscription')
        .select(['id', 'projectId', 'checkoutId'])
        .where('whopMembershipId', '=', ev.membershipId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const account =
    !checkout?.projectId && !subscription?.projectId && !metadataProjectId
      ? await lookupAccount(ev.companyId, env, trx)
      : null
  const projectId = checkout?.projectId || subscription?.projectId || metadataProjectId || null
  const checkoutId = checkout?.id || subscription?.checkoutId || null
  const subscriptionId = subscription?.id || null
  const accountId =
    checkout?.accountId ||
    account?.id ||
    (!checkout && subscription?.checkoutId
      ? (
          await trx
            .selectFrom('pay_checkout_session')
            .select('accountId')
            .where('id', '=', subscription.checkoutId)
            .executeTakeFirst()
        )?.accountId
      : null) ||
    null

  const now = new Date()
  const happenedAt = toDate(ev.occurredAt) || now
  const existingInvoice = await trx
    .selectFrom('pay_invoice')
    .select('status')
    .where('whopInvoiceId', '=', ev.invoiceId)
    .where('env', '=', env)
    .executeTakeFirst()
  const status = resolveInvoiceStatus(
    existingInvoice?.status,
    statusFromInvoice(eventType, ev.status),
  )
  const currency = (ev.currency || 'usd').toLowerCase()
  const amount = ev.amount ?? 0
  const dueAt = toDate(ev.dueAt)
  const paidAt = toDate(ev.paidAt)
  const voidedAt = toDate(ev.voidedAt)

  const linking = { projectId, checkoutId, subscriptionId, dueAt, paidAt, voidedAt }

  await trx
    .insertInto('pay_invoice')
    .values({
      whopInvoiceId: ev.invoiceId,
      ...linking,
      status,
      amount,
      currency,
      hostedUrl: null,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      env,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['whopInvoiceId', 'env']).doUpdateSet({
        status,
        amount,
        currency,
        metadata: ev.metadata,
        raw: eventSummary(ev),
        ...defined(linking),
        updatedAt: now,
      }),
    )
    .execute()

  const invoice = await trx
    .selectFrom('pay_invoice')
    .select('id')
    .where('whopInvoiceId', '=', ev.invoiceId)
    .where('env', '=', env)
    .executeTakeFirst()

  await upsertTransaction(
    {
      kind: 'invoice',
      sourceId: ev.invoiceId,
      projectId,
      accountId,
      checkoutId: invoice ? checkoutId : null,
      subscriptionId,
      invoiceId: invoice?.id || null,
      status,
      amount,
      currency,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      happenedAt,
      env,
    },
    trx,
  )
}

async function upsertWithdrawalFromWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.withdrawalId) return

  const account = ev.companyId
    ? await trx
        .selectFrom('pay_account')
        .select(['id', 'projectId'])
        .where('whopCompanyId', '=', ev.companyId)
        .where('env', '=', env)
        .executeTakeFirst()
    : null

  const projectId = (await resolveProjectId(trx, extractProjectId(ev.metadata))) || null
  const status = statusFromWithdrawal(eventType, ev.status)
  const amount = ev.amount ?? 0
  const now = new Date()
  const happenedAt = toDate(ev.occurredAt) || now
  const currency = (ev.currency || 'usd').toLowerCase()

  const payoutTx = await upsertTransaction(
    {
      kind: 'payout',
      sourceId: ev.withdrawalId,
      projectId,
      accountId: account?.id || null,
      status,
      amount,
      currency,
      metadata: ev.metadata,
      raw: eventSummary(ev),
      happenedAt,
      env,
    },
    trx,
  )

  const feeAmount = ev.feeAmount ?? 0
  if (feeAmount > 0 && payoutTx?.id) {
    await upsertTransaction(
      {
        kind: 'processor_fee',
        sourceId: `${ev.withdrawalId}:processor_fee`,
        projectId,
        accountId: account?.id || null,
        payoutTransactionId: payoutTx.id,
        incurredByTransactionId: payoutTx.id,
        processorFeeType: ev.feeType || 'payout',
        status: 'succeeded',
        amount: feeAmount,
        currency,
        metadata: ev.metadata,
        raw: eventSummary(ev),
        happenedAt,
        env,
      },
      trx,
    )
  }
}

async function handleVerificationWebhook(
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv,
  trx: Trx,
) {
  if (!ev.companyId) return

  const verificationStatus =
    eventType === 'verification.succeeded'
      ? 'succeeded'
      : eventType === 'verification.failed'
        ? 'failed'
        : null
  if (!verificationStatus) return

  const row = await trx
    .selectFrom('pay_account')
    .select(['metadata'])
    .where('whopCompanyId', '=', ev.companyId)
    .where('env', '=', env)
    .executeTakeFirst()
  if (!row) return

  await trx
    .updateTable('pay_account')
    .set({
      metadata: {
        ...(row.metadata || {}),
        verificationStatus,
        verification: eventSummary(ev),
      },
      updatedAt: new Date(),
    })
    .where('whopCompanyId', '=', ev.companyId)
    .where('env', '=', env)
    .execute()
}

// --- Advisory lock key resolution ---

export function resolveEntityLockKey(eventType: string, ev: ParsedWhopWebhookEvent): string | null {
  if (eventType.startsWith('payment.') && ev.paymentId) return `payment:${ev.paymentId}`
  if (eventType.startsWith('membership.') && ev.membershipId) return `membership:${ev.membershipId}`
  if (eventType.startsWith('refund.') && ev.paymentId) return `payment:${ev.paymentId}`
  if (eventType.startsWith('dispute.') && ev.paymentId) return `payment:${ev.paymentId}`
  if (eventType.startsWith('invoice.') && ev.membershipId) return `membership:${ev.membershipId}`
  if (eventType.startsWith('invoice.') && ev.invoiceId) return `invoice:${ev.invoiceId}`
  if (eventType.startsWith('withdrawal.') && ev.withdrawalId) return `withdrawal:${ev.withdrawalId}`
  if (eventType.startsWith('verification.') && ev.companyId) return `company:${ev.companyId}`
  return null
}

// --- Main dispatcher ---

export async function processWebhookEvent(
  eventId: string,
  eventType: string,
  ev: ParsedWhopWebhookEvent,
  env: PayEnv = 'live',
): Promise<void> {
  const tag = `[QUEUE:whop:${env}]`

  await db.transaction().execute(async (trx) => {
    // Atomically claim — skip if already processed or currently processing
    const claimed = await trx
      .updateTable('pay_webhook_event')
      .set({ status: 'processing' })
      .where('id', '=', eventId)
      .where('status', 'in', ['pending', 'failed'])
      .returning('id')
      .executeTakeFirst()

    if (!claimed) {
      log.debug({ eventId }, `${tag} ${eventType} skipped (already claimed)`)
      return
    }
    log.info({ eventId }, `${tag} ${eventType} claimed`)

    const lockKey = resolveEntityLockKey(eventType, ev)
    if (lockKey) {
      log.debug({ eventId, lockKey }, `${tag} acquiring lock`)
      await sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`.execute(trx)
      log.debug({ eventId, lockKey }, `${tag} lock acquired`)
    }

    const handler = eventType.startsWith('payment.')
      ? 'payment'
      : eventType.startsWith('membership.')
        ? 'membership'
        : eventType.startsWith('refund.')
          ? 'refund'
          : eventType.startsWith('dispute.')
            ? 'dispute'
            : eventType.startsWith('invoice.')
              ? 'invoice'
              : eventType.startsWith('withdrawal.')
                ? 'withdrawal'
                : eventType.startsWith('verification.')
                  ? 'verification'
                  : null

    if (handler) {
      log.info({ eventId }, `${tag} ${eventType} → ${handler} handler`)
    }

    if (eventType.startsWith('payment.')) {
      await upsertPaymentFromWebhook(eventType, ev, env, trx)
    } else if (eventType.startsWith('membership.')) {
      await upsertMembershipFromWebhook(eventType, ev, env, trx)
    } else if (eventType.startsWith('refund.')) {
      await upsertRefundFromWebhook(eventType, ev, env, trx)
    } else if (eventType.startsWith('dispute.')) {
      await upsertDisputeFromWebhook(eventType, ev, env, trx)
    } else if (eventType.startsWith('invoice.')) {
      await upsertInvoiceFromWebhook(eventType, ev, env, trx)
    } else if (eventType.startsWith('withdrawal.')) {
      await upsertWithdrawalFromWebhook(eventType, ev, env, trx)
    } else if (eventType.startsWith('verification.')) {
      await handleVerificationWebhook(eventType, ev, env, trx)
    } else {
      log.warn({ eventId }, `${tag} ${eventType} no handler matched`)
    }

    await trx
      .updateTable('pay_webhook_event')
      .set({ status: 'processed', handledAt: new Date(), error: null })
      .where('id', '=', eventId)
      .execute()

    log.info({ eventId }, `${tag} ${eventType} processed`)
  })
}
