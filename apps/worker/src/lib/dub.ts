import { Dub } from 'dub'
import { createLogger } from './logger'

const log = createLogger('dub')

let _dub: Dub | undefined
function getDub() {
  return (_dub ??= new Dub())
}

type DubLeadArgs = {
  clickId: string
  eventName?: string
  customerExternalId: string
  customerName?: string | null
  customerEmail?: string | null
  customerAvatar?: string | null
  metadata?: Record<string, unknown> | null
}

type DubSaleArgs = {
  customerExternalId: string
  amount: number
  currency?: string | null
  eventName?: string
  invoiceId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function trackDubLead(args: DubLeadArgs) {
  if (!process.env.DUB_API_KEY) {
    log.warn('DUB_API_KEY missing, skipping lead')
    return false
  }

  const eventName = args.eventName || 'Sign Up'
  try {
    await getDub().track.lead({
      clickId: args.clickId,
      eventName,
      customerExternalId: args.customerExternalId,
      customerName: args.customerName ?? undefined,
      customerEmail: args.customerEmail ?? undefined,
      customerAvatar: args.customerAvatar ?? undefined,
      metadata: args.metadata ?? undefined,
    })
    log.info(
      { customerExternalId: args.customerExternalId, clickId: args.clickId, eventName },
      'lead tracked',
    )
    return true
  } catch (err) {
    log.error(
      { err, customerExternalId: args.customerExternalId, clickId: args.clickId, eventName },
      'lead tracking failed',
    )
    return false
  }
}

export async function trackDubSale(args: DubSaleArgs) {
  if (!process.env.DUB_API_KEY) {
    log.warn('DUB_API_KEY missing, skipping sale')
    return false
  }

  if (!args.customerExternalId || !Number.isFinite(args.amount) || args.amount <= 0) {
    log.warn(
      {
        customerExternalId: args.customerExternalId,
        amount: args.amount,
        invoiceId: args.invoiceId ?? null,
      },
      'incomplete sale payload, skipping',
    )
    return false
  }

  const payload = {
    customerExternalId: args.customerExternalId,
    amount: Math.round(args.amount),
    currency: (args.currency || 'usd').toLowerCase(),
    eventName: args.eventName || 'Purchase',
    invoiceId: args.invoiceId ?? null,
  }

  try {
    await getDub().track.sale({
      ...payload,
      invoiceId: payload.invoiceId ?? undefined,
      paymentProcessor: 'stripe',
      metadata: args.metadata ?? undefined,
    })
    log.info(payload, 'sale tracked')
    return true
  } catch (err) {
    log.error({ err, ...payload }, 'sale tracking failed')
    return false
  }
}
