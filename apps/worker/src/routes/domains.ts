import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '@/middleware/auth'
import { db } from '@/lib/db'
import { entriClient } from '@/lib/entri/client'
import { generateEntriToken } from '@/lib/entri/jwt'
import { config } from '@/lib/config'
import { HttpError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { AppContext } from '@/types/application'

const log = createLogger('domains')

const domains = new Hono<AppContext>()

// ─── Auth-protected routes ───────────────────────────────────

domains.use('/*', requireAuth)

/**
 * POST /api/domains/check-availability
 * Check if a domain is available for purchase via Entri
 */
domains.post(
  '/check-availability',
  zValidator(
    'json',
    z.object({
      domain: z.string().min(3).max(255),
    }),
  ),
  async (c) => {
    const { domain } = c.req.valid('json')
    const result = await entriClient.checkAvailability(domain)
    return c.json(result)
  },
)

/**
 * POST /api/domains/init-purchase
 * Generate Entri JWT and config to launch the Sell modal
 */
domains.post(
  '/init-purchase',
  zValidator(
    'json',
    z.object({
      projectId: z.string().uuid(),
      suggestedDomain: z.string().max(255).optional(),
    }),
  ),
  async (c) => {
    const user = c.get('user')!
    const session = c.get('session')!
    const { projectId, suggestedDomain } = c.req.valid('json')

    // Verify project belongs to user's org
    const project = await db
      .selectFrom('project')
      .select(['id', 'organizationId'])
      .where('id', '=', projectId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()

    if (!project) throw new HttpError(404, 'Project not found')

    if (session.activeOrganizationId && project.organizationId !== session.activeOrganizationId) {
      throw new HttpError(403, 'Forbidden')
    }

    // Check if project already has an active/pending domain
    const existingDomain = await db
      .selectFrom('domain')
      .select('id')
      .where('projectId', '=', projectId)
      .where('status', 'in', ['active', 'purchasing', 'dns_configuring'])
      .executeTakeFirst()

    if (existingDomain) {
      throw new HttpError(409, 'Project already has a domain')
    }

    const token = await generateEntriToken(user.id)

    // Get worker script name for DNS target
    const worker = await db
      .selectFrom('worker')
      .select(['scriptName', 'status'])
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    const deployDomain = config.cloudflare.deployDomain
    const dnsTarget = worker?.scriptName
      ? `${worker.scriptName}.${deployDomain}`
      : `${projectId.slice(0, 8)}.${deployDomain}`

    const dnsRecords = [
      { type: 'CNAME', host: '@', value: dnsTarget, ttl: 300 },
      { type: 'CNAME', host: 'www', value: dnsTarget, ttl: 300 },
    ]

    // Create pending domain record
    const now = new Date()
    const domain = await db
      .insertInto('domain')
      .values({
        projectId,
        userId: user.id,
        organizationId: session.activeOrganizationId,
        domainName: suggestedDomain || 'pending',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning(['id'])
      .executeTakeFirst()

    log.info({ projectId, domainId: domain?.id, suggestedDomain }, 'domain purchase initialized')

    return c.json({
      token,
      applicationId: config.entri.applicationId,
      dnsRecords,
      domainId: domain!.id,
      prefilledDomain: suggestedDomain,
      devMode: config.entri.devMode,
      contact: {
        email: user.email,
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || '',
      },
    })
  },
)

/**
 * GET /api/domains/:projectId
 * List domains for a project
 */
domains.get('/:projectId', async (c) => {
  const user = c.get('user')!
  const session = c.get('session')!
  const projectId = c.req.param('projectId')

  // Verify project access
  const project = await db
    .selectFrom('project')
    .select(['id', 'organizationId'])
    .where('id', '=', projectId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()

  if (!project) throw new HttpError(404, 'Project not found')

  if (session.activeOrganizationId && project.organizationId !== session.activeOrganizationId) {
    throw new HttpError(403, 'Forbidden')
  }

  const result = await db
    .selectFrom('domain')
    .selectAll()
    .where('projectId', '=', projectId)
    .orderBy('createdAt', 'desc')
    .execute()

  return c.json({
    domains: result.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      domainName: d.domainName,
      status: d.status,
      registrar: d.registrar,
      purchasedAt: d.purchasedAt?.toISOString() ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  })
})

/**
 * DELETE /api/domains/:projectId/:domainId
 * Remove a domain record (does not cancel at registrar)
 */
domains.delete('/:projectId/:domainId', async (c) => {
  const user = c.get('user')!
  const projectId = c.req.param('projectId')
  const domainId = c.req.param('domainId')

  const domain = await db
    .selectFrom('domain')
    .selectAll()
    .where('id', '=', domainId)
    .where('projectId', '=', projectId)
    .where('userId', '=', user.id)
    .executeTakeFirst()

  if (!domain) throw new HttpError(404, 'Domain not found')

  await db.deleteFrom('domain').where('id', '=', domainId).execute()

  log.info({ projectId, domainId, domainName: domain.domainName }, 'domain removed')

  return c.json({ deleted: true })
})

/**
 * POST /api/domains/mock-purchase
 * Dev-only: simulate a successful domain purchase without Entri/payment
 */
domains.post(
  '/mock-purchase',
  zValidator(
    'json',
    z.object({
      domainId: z.string().uuid(),
      domainName: z.string().min(3).max(255),
    }),
  ),
  async (c) => {
    if (!config.entri.devMode) {
      throw new HttpError(403, 'Mock purchase is only available in dev mode')
    }

    const user = c.get('user')!
    const { domainId, domainName } = c.req.valid('json')

    const domain = await db
      .selectFrom('domain')
      .selectAll()
      .where('id', '=', domainId)
      .where('userId', '=', user.id)
      .executeTakeFirst()

    if (!domain) throw new HttpError(404, 'Domain not found')

    await db
      .updateTable('domain')
      .set({
        domainName,
        status: 'active',
        registrar: 'mock-dev',
        purchasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', domainId)
      .execute()

    log.info({ domainId, domainName }, '[DEV] mock purchase completed')

    return c.json({ ok: true, domainName, status: 'active' })
  },
)

export default domains

// ─── Webhook handler (no auth) ───────────────────────────────

export const domainWebhooks = new Hono<AppContext>()

/**
 * POST /api/domains/webhooks/entri
 * Receives domain purchase/DNS events from Entri
 */
domainWebhooks.post('/webhooks/entri', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('x-entri-signature') || ''
  const webhookSecret = config.entri.webhookSecret

  if (!webhookSecret) {
    log.error('ENTRI_WEBHOOK_SECRET not configured')
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  // Verify HMAC-SHA256 signature
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expectedHex = Buffer.from(expected).toString('hex')

  if (signature.length !== expectedHex.length) {
    log.warn('webhook signature length mismatch')
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // Timing-safe comparison
  const a = new TextEncoder().encode(signature)
  const b = new TextEncoder().encode(expectedHex)
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  if (diff !== 0) {
    log.warn('webhook signature mismatch')
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const payload = (() => {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  })()

  if (!payload || typeof payload !== 'object') {
    return c.json({ error: 'Invalid payload' }, 400)
  }

  const eventType = payload.type || payload.event || 'unknown'
  log.info({ eventType, domain: payload.domain }, '[ENTRI-WEBHOOK] received')

  // Store webhook event
  await db
    .insertInto('domain_webhook_event')
    .values({
      entriEventId: payload.id || null,
      eventType,
      domainName: payload.domain || payload.purchased_domains?.[0] || null,
      payload: payload as Record<string, unknown>,
      status: 'pending',
    })
    .execute()

  // Process synchronously (domain events are low volume)
  try {
    await processDomainWebhook(payload)
  } catch (err) {
    log.error({ err, eventType }, '[ENTRI-WEBHOOK] processing error')
  }

  return c.json({ received: true }, 202)
})

async function processDomainWebhook(payload: any) {
  const eventType = payload.type || payload.event
  const domainName = payload.purchased_domains?.[0] || payload.domain
  const userId = payload.user_id

  if (eventType === 'domain.added' || eventType === 'domainPurchased') {
    if (!userId && !domainName) {
      log.warn('[ENTRI-WEBHOOK] no user_id or domain in payload')
      return
    }

    // Find the pending domain for this user
    let query = db
      .selectFrom('domain')
      .selectAll()
      .where('status', 'in', ['pending', 'purchasing'])
      .orderBy('createdAt', 'desc')

    if (userId) {
      query = query.where('userId', '=', userId)
    }

    const domainRecord = await query.executeTakeFirst()

    if (!domainRecord) {
      log.warn({ userId, domainName }, '[ENTRI-WEBHOOK] no pending domain found')
      return
    }

    const propagationOk =
      payload.propagation_status === 'success' ||
      payload.dns_status === 'configured' ||
      eventType === 'domainPurchased'

    await db
      .updateTable('domain')
      .set({
        domainName: domainName || domainRecord.domainName,
        status: propagationOk ? 'active' : 'dns_configuring',
        registrar: payload.provider || payload.registrar || null,
        entriFlowId: payload.id || null,
        purchasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', domainRecord.id)
      .execute()

    log.info(
      {
        domainId: domainRecord.id,
        domainName,
        status: propagationOk ? 'active' : 'dns_configuring',
      },
      '[ENTRI-WEBHOOK] domain updated',
    )

    // Update webhook event status
    if (payload.id) {
      await db
        .updateTable('domain_webhook_event')
        .set({ status: 'processed', processedAt: new Date() })
        .where('entriEventId', '=', payload.id)
        .execute()
    }
  } else if (eventType === 'domain.failed' || eventType === 'domainFailed') {
    // Mark domain as error
    if (userId) {
      await db
        .updateTable('domain')
        .set({
          status: 'error',
          updatedAt: new Date(),
        })
        .where('userId', '=', userId)
        .where('status', 'in', ['pending', 'purchasing'])
        .execute()
    }

    log.warn({ userId, domainName, eventType }, '[ENTRI-WEBHOOK] domain purchase failed')
  } else if (eventType === 'dns.propagated' || eventType === 'dnsConfigured') {
    // DNS propagation complete — mark as active
    if (domainName) {
      await db
        .updateTable('domain')
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where('domainName', '=', domainName)
        .where('status', '=', 'dns_configuring')
        .execute()

      log.info({ domainName }, '[ENTRI-WEBHOOK] DNS propagated, domain active')
    }
  } else {
    log.info({ eventType }, '[ENTRI-WEBHOOK] unhandled event type')
  }
}
