import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql } from 'kysely'
import { requireAuth } from '@/middleware/auth'
import { db } from '@/lib/db'
import { generateEntriToken } from '@/lib/entri/jwt'
import { getDomainProvider, expandDomainQuery } from '@/lib/domains'
import { disconnectCustomDomain } from '@/lib/cloudflare/custom-hostnames'
import { config } from '@/lib/config'
import { HttpError } from '@/lib/errors'
import { rateLimit } from '@/middleware/rate-limit'
import { createLogger } from '@/lib/logger'
import type { AppContext } from '@/types/application'
import type { DomainLogEntry } from '@repo/db'

const log = createLogger('domains')

/** Append a log entry to a domain's logs JSONB column. */
async function appendDomainLog(
  domainId: string,
  event: string,
  detail?: string,
  success?: boolean,
) {
  const entry: DomainLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...(detail !== undefined && { detail }),
    ...(success !== undefined && { success }),
  }
  await db
    .updateTable('domain')
    .set({
      logs: sql`COALESCE(logs, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb`,
      updatedAt: new Date(),
    })
    .where('id', '=', domainId)
    .execute()
}

// ─── SSL provisioning metadata (dedicated sslMeta JSONB column) ────

interface SslProvisioningMeta {
  _type: 'ssl_provisioning_meta'
  attempts: number
  firstAttemptAt: string
  lastAttemptAt: string
}

// ─── TXT domain verification ─────────────────────────────────

/** Generate a deterministic verification token for a project's domain. */
function generateVerifyToken(projectId: string): string {
  const secret = config.entri.secret || 'surgent-verify'
  return sha256(`${projectId}:${secret}`).slice(0, 32)
}

/** Build the TXT verification record for inclusion in Entri DNS config. */
function buildVerifyTxtRecord(projectId: string) {
  return {
    type: 'TXT' as const,
    host: '_surgent-verify',
    value: `surgent-verify=${generateVerifyToken(projectId)}`,
    ttl: 300,
  }
}

const domains = new Hono<AppContext>()

// ─── Auth-protected routes ───────────────────────────────────

domains.use('/*', requireAuth)

/**
 * GET /api/domains/config
 * Returns domain feature flags for the frontend.
 */
domains.get('/config', async (c) => {
  return c.json({
    freeDomainEnabled: config.freeDomain.enabled,
  })
})

/**
 * POST /api/domains/check-availability
 * Check if a domain is available for purchase.
 * Uses Entri to check domain availability.
 */
domains.post(
  '/check-availability',
  rateLimit(20, 60_000),
  zValidator(
    'json',
    z.object({
      domain: z.string().min(3).max(255),
    }),
  ),
  async (c) => {
    const { domain } = c.req.valid('json')
    const provider = await getDomainProvider()

    // Expand bare queries (e.g. "coolapp") into multiple TLDs.
    // If the query already has a dot (e.g. "coolapp.com"), check just that one.
    const domainsToCheck = domain.includes('.') ? [domain] : expandDomainQuery(domain)
    const results = await provider.checkAvailability(domainsToCheck)

    return c.json(results)
  },
)

/**
 * POST /api/domains/init-purchase
 * Initialize domain purchase flow.
 * Returns JWT + config to launch the Entri modal on the frontend.
 */
domains.post(
  '/init-purchase',
  rateLimit(5, 3_600_000),
  zValidator(
    'json',
    z.object({
      projectId: z.string().uuid(),
      suggestedDomain: z.string().max(255).optional(),
      freeDomain: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const user = c.get('user')!
    const session = c.get('session')!
    const { projectId, suggestedDomain, freeDomain } = c.req.valid('json')

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

    // Check domain limits
    const domainCount = await db
      .selectFrom('domain')
      .select(db.fn.count('id').as('count'))
      .where('projectId', '=', projectId)
      .where('status', '!=', 'error')
      .executeTakeFirst()

    if (Number(domainCount?.count ?? 0) >= 5) {
      throw new HttpError(409, 'Maximum 5 domains per project')
    }

    // Free domain eligibility check
    if (freeDomain) {
      if (!config.freeDomain.enabled) {
        throw new HttpError(403, 'Free domains are not currently available')
      }

      const freeCount = await db
        .selectFrom('domain')
        .select(db.fn.count('id').as('count'))
        .where('userId', '=', user.id)
        .where('registrar', 'like', '%free%')
        .executeTakeFirst()

      if (Number(freeCount?.count ?? 0) >= config.freeDomain.maxPerUser) {
        throw new HttpError(409, `You've already claimed your free domain`)
      }
    }

    // Get worker script name for DNS target
    const worker = await db
      .selectFrom('worker')
      .select(['scriptName', 'status'])
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    if (!worker?.scriptName) {
      throw new HttpError(400, 'Deploy your app before adding a custom domain')
    }

    const deployDomain = config.cloudflare.deployDomain

    // Entri Power: root A record proxied by Entri + www CNAME via Entri's cname_target
    const applicationUrl = `https://${worker.scriptName}.${deployDomain}`

    const dnsRecords = [
      { type: 'A', host: '@', value: '{ENTRI_SERVERS}', ttl: 300, applicationUrl },
      { type: 'CNAME', host: 'www', value: '{CNAME_TARGET}', ttl: 300, applicationUrl },
      buildVerifyTxtRecord(projectId),
    ]

    // ── Entri: return config for frontend modal ──────────────
    // Don't create a DB record yet — the webhook will create/update it
    // when the purchase completes. This avoids stale "pending" records
    // if the user closes the modal without buying.
    const token = await generateEntriToken(user.id)

    log.info({ projectId, suggestedDomain }, 'domain purchase initialized (Entri modal)')

    return c.json({
      token,
      applicationId: config.entri.applicationId,
      dnsRecords,
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
 * POST /api/domains/init-connect
 * Initialize Entri Connect flow for an existing domain the user already owns.
 * Returns JWT + DNS config to launch the Entri Connect modal on the frontend.
 */
domains.post(
  '/init-connect',
  rateLimit(10, 3_600_000),
  zValidator(
    'json',
    z.object({
      projectId: z.string().uuid(),
      domain: z.string().min(3).max(255),
    }),
  ),
  async (c) => {
    const user = c.get('user')!
    const session = c.get('session')!
    const { projectId, domain: domainInput } = c.req.valid('json')

    // Strip www. prefix if provided
    const domain = domainInput.replace(/^www\./i, '')

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

    // Check domain limits
    const domainCount = await db
      .selectFrom('domain')
      .select(db.fn.count('id').as('count'))
      .where('projectId', '=', projectId)
      .where('status', '!=', 'error')
      .executeTakeFirst()

    if (Number(domainCount?.count ?? 0) >= 5) {
      throw new HttpError(409, 'Maximum 5 domains per project')
    }

    // Check if project already has a primary domain
    const existingPrimary = await db
      .selectFrom('domain')
      .select(['id', 'domainName'])
      .where('projectId', '=', projectId)
      .where('isPrimary', '=', true)
      .where('status', 'in', ['active', 'ssl_provisioning', 'purchasing', 'dns_configuring'])
      .executeTakeFirst()

    const isPrimary = !existingPrimary
    const redirectTarget = existingPrimary ? existingPrimary.domainName : null

    // Get worker script name for DNS target
    const worker = await db
      .selectFrom('worker')
      .select(['scriptName', 'status'])
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    if (!worker?.scriptName) {
      throw new HttpError(400, 'Deploy your app before adding a custom domain')
    }

    const deployDomain = config.cloudflare.deployDomain

    // Entri Power: root A record proxied by Entri + www CNAME via Entri's cname_target
    const applicationUrl = `https://${worker.scriptName}.${deployDomain}`

    const dnsRecords = [
      { type: 'A', host: '@', value: '{ENTRI_SERVERS}', ttl: 300, applicationUrl },
      { type: 'CNAME', host: 'www', value: '{CNAME_TARGET}', ttl: 300, applicationUrl },
      buildVerifyTxtRecord(projectId),
    ]

    const token = await generateEntriToken(user.id)

    // Check if this domain name already exists (e.g., from a previous attempt or re-connect)
    const now = new Date()
    let domainRecord = await db
      .selectFrom('domain')
      .select(['id', 'status'])
      .where('domainName', '=', domain)
      .executeTakeFirst()

    if (domainRecord) {
      // Reuse existing record — reset with clean logs
      await db
        .updateTable('domain')
        .set({
          projectId,
          userId: user.id,
          organizationId: session.activeOrganizationId,
          status: 'dns_configuring',
          registrar: 'entri-connect',
          isPrimary,
          redirectTarget,
          lastError: null,
          sslMeta: null,
          dnsVerified: false,
          routingConfigured: false,
          logs: sql`'[]'::jsonb`,
          updatedAt: now,
        })
        .where('id', '=', domainRecord.id)
        .execute()
    } else {
      // Create new domain record
      domainRecord = await db
        .insertInto('domain')
        .values({
          projectId,
          userId: user.id,
          organizationId: session.activeOrganizationId,
          domainName: domain,
          status: 'dns_configuring',
          registrar: 'entri-connect',
          isPrimary,
          redirectTarget,
          createdAt: now,
          updatedAt: now,
        })
        .returning(['id', 'status'])
        .executeTakeFirst()
    }

    await appendDomainLog(domainRecord!.id, 'connect_initiated', `DNS setup started for ${domain}`)

    // Quick check: if domain is already reachable (re-connect of previously live domain),
    // fast-track it to ssl_provisioning so the health checker can promote it immediately
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      })
      clearTimeout(timeout)
      if (res.status < 500) {
        await db
          .updateTable('domain')
          .set({
            status: 'ssl_provisioning',
            dnsVerified: true,
            routingConfigured: true,
            updatedAt: new Date(),
          })
          .where('id', '=', domainRecord!.id)
          .execute()
        await appendDomainLog(
          domainRecord!.id,
          'auto_promote',
          'Domain already reachable, fast-tracked to SSL check',
          true,
        )
        log.info({ domainId: domainRecord!.id, domain }, 'domain already reachable, fast-tracked')
      }
    } catch {
      // Domain not reachable yet — normal for new connections, health checker will pick it up
    }

    log.info({ projectId, domainId: domainRecord?.id, domain }, 'domain connect initialized')

    return c.json({
      token,
      applicationId: config.entri.applicationId,
      dnsRecords,
      domainId: domainRecord!.id,
      prefilledDomain: domain,
      userId: user.email,
    })
  },
)

/**
 * GET /api/domains/:projectId
 * List domains for a project
 */
domains.get('/:projectId', async (c) => {
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

  // Health checks are now handled by the background domain-health-checker job
  // GET endpoint is a pure read — no side effects

  return c.json({
    domains: result.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      domainName: d.domainName,
      status: d.status,
      registrar: d.registrar,
      dnsVerified: d.dnsVerified,
      routingConfigured: d.routingConfigured,
      isPrimary: (d as any).isPrimary ?? true,
      redirectTarget: (d as any).redirectTarget ?? null,
      lastError: d.lastError,
      sslMeta: d.sslMeta ?? null,
      logs: d.logs ?? [],
      purchasedAt: d.purchasedAt?.toISOString() ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  })
})

/**
 * POST /api/domains/retry-connect
 * Re-open Entri Connect for a domain stuck in dns_configuring or error.
 * Returns fresh JWT + config without creating a new DB record.
 */
domains.post(
  '/retry-connect',
  zValidator(
    'json',
    z.object({
      projectId: z.string().uuid(),
      domainId: z.string().uuid(),
    }),
  ),
  async (c) => {
    const user = c.get('user')!
    const { projectId, domainId } = c.req.valid('json')

    const domainRecord = await db
      .selectFrom('domain')
      .selectAll()
      .where('id', '=', domainId)
      .where('projectId', '=', projectId)
      .where('userId', '=', user.id)
      .executeTakeFirst()

    if (!domainRecord) throw new HttpError(404, 'Domain not found')

    if (!['dns_configuring', 'ssl_provisioning', 'error'].includes(domainRecord.status)) {
      throw new HttpError(400, 'Domain is not in a retryable state')
    }

    // Smart retry: if DNS is already verified, just retry SSL provisioning
    // (don't re-open Entri modal — DNS is already configured)
    const isSslRetry = domainRecord.dnsVerified
    if (isSslRetry) {
      const freshMeta: SslProvisioningMeta = {
        _type: 'ssl_provisioning_meta',
        attempts: 0,
        firstAttemptAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
      }
      await db
        .updateTable('domain')
        .set({
          status: 'ssl_provisioning',
          sslMeta: freshMeta as any,
          lastError: null,
          updatedAt: new Date(),
        })
        .where('id', '=', domainId)
        .execute()

      await appendDomainLog(
        domainId,
        'retry_ssl',
        `Retrying SSL provisioning (DNS already verified)`,
      )
      log.info({ projectId, domainId, domainName: domainRecord.domainName }, 'SSL retry started')

      return c.json({ sslRetryOnly: true, domainId })
    }

    // Full retry: re-open Entri modal for DNS setup
    const worker = await db
      .selectFrom('worker')
      .select(['scriptName'])
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    const deployDomain = config.cloudflare.deployDomain

    // Entri Power: root A record proxied by Entri + www CNAME via Entri's cname_target
    const applicationUrl = worker?.scriptName
      ? `https://${worker.scriptName}.${deployDomain}`
      : `https://${deployDomain}`

    const dnsRecords = [
      { type: 'A', host: '@', value: '{ENTRI_SERVERS}', ttl: 300, applicationUrl },
      { type: 'CNAME', host: 'www', value: '{CNAME_TARGET}', ttl: 300, applicationUrl },
      buildVerifyTxtRecord(projectId),
    ]

    const token = await generateEntriToken(user.id)

    // Reset status to dns_configuring if it was error
    if (domainRecord.status === 'error') {
      await db
        .updateTable('domain')
        .set({ status: 'dns_configuring', lastError: null, updatedAt: new Date() })
        .where('id', '=', domainId)
        .execute()
    }

    await appendDomainLog(
      domainId,
      'retry_connect',
      `User retried DNS setup (was ${domainRecord.status})`,
    )
    log.info({ projectId, domainId, domainName: domainRecord.domainName }, 'domain connect retry')

    return c.json({
      token,
      applicationId: config.entri.applicationId,
      dnsRecords,
      domainId,
      prefilledDomain: domainRecord.domainName,
      userId: user.email,
    })
  },
)

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

  // Already deleted (duplicate request) — return success idempotently
  if (!domain) return c.json({ deleted: true })

  // Disconnect from Cloudflare (custom hostname + KV mapping)
  await appendDomainLog(domainId, 'domain_removing', 'User requested domain removal')
  await disconnectCustomDomain(domain.domainName, domain.cfCustomDomainId)

  await db.deleteFrom('domain').where('id', '=', domainId).execute()

  log.info({ projectId, domainId, domainName: domain.domainName }, 'domain removed')

  return c.json({ deleted: true })
})

/**
 * POST /api/domains/set-primary
 * Promote an alias domain to primary (demotes current primary to alias).
 */
domains.post(
  '/set-primary',
  zValidator(
    'json',
    z.object({
      projectId: z.string().uuid(),
      domainId: z.string().uuid(),
    }),
  ),
  async (c) => {
    const user = c.get('user')!
    const { projectId, domainId } = c.req.valid('json')

    const domain = await db
      .selectFrom('domain')
      .selectAll()
      .where('id', '=', domainId)
      .where('projectId', '=', projectId)
      .where('userId', '=', user.id)
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!domain) throw new HttpError(404, 'Domain not found or not active')

    if (domain.isPrimary) {
      return c.json({ ok: true, message: 'Already primary' })
    }

    // Demote current primary to alias
    await db
      .updateTable('domain')
      .set({
        isPrimary: false,
        redirectTarget: domain.domainName,
        updatedAt: new Date(),
      })
      .where('projectId', '=', projectId)
      .where('isPrimary', '=', true)
      .execute()

    // Promote selected domain to primary
    await db
      .updateTable('domain')
      .set({
        isPrimary: true,
        redirectTarget: null,
        updatedAt: new Date(),
      })
      .where('id', '=', domainId)
      .execute()

    await appendDomainLog(
      domainId,
      'set_primary',
      `${domain.domainName} is now the primary domain`,
      true,
    )

    return c.json({ ok: true, primaryDomain: domain.domainName })
  },
)

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
    if (!config.entri.devMode || process.env.NODE_ENV === 'production') {
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

const SIGNATURE_MAX_AGE_S = 300 // 5 minutes

/** SHA-256 hex digest of a string. */
function sha256(input: string): string {
  return new Bun.CryptoHasher('sha256').update(input).digest('hex')
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verify Entri webhook signature.
 * V2 (recommended): SHA256(id + timestamp + secret), header Entri-Signature-V2
 * V1 (legacy):      SHA256(id + secret),             header Entri-Signature
 * @see https://developers.entri.com/docs/webhooks
 */
function verifyEntriSignature(
  webhookId: string,
  secret: string,
  headers: { signatureV2: string; signatureV1: string; timestamp: string },
): { valid: boolean; version: 'v2' | 'v1' | null; error?: string } {
  if (headers.signatureV2 && headers.timestamp) {
    const ts = parseInt(headers.timestamp, 10)
    if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > SIGNATURE_MAX_AGE_S) {
      return { valid: false, version: 'v2', error: 'timestamp expired' }
    }
    const expected = sha256(`${webhookId}${headers.timestamp}${secret}`)
    return { valid: timingSafeEqual(headers.signatureV2, expected), version: 'v2' }
  }

  if (headers.signatureV1) {
    const expected = sha256(`${webhookId}${secret}`)
    return { valid: timingSafeEqual(headers.signatureV1, expected), version: 'v1' }
  }

  return { valid: false, version: null, error: 'no signature header' }
}

/**
 * POST /api/domains/webhooks/entri
 * Receives domain purchase/DNS events from Entri
 */
domainWebhooks.post('/webhooks/:provider', async (c) => {
  const body = await c.req.text()
  const isProduction = process.env.NODE_ENV === 'production'

  // Parse payload first — needed for both signature verification and processing
  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  if (!payload || typeof payload !== 'object') {
    return c.json({ error: 'Invalid payload' }, 400)
  }

  // Signature verification
  const webhookSecret = config.entri.webhookSecret
  if (!webhookSecret) {
    if (isProduction) {
      log.error('[ENTRI-WEBHOOK] ENTRI_WEBHOOK_SECRET not configured')
      return c.json({ error: 'Webhook not configured' }, 500)
    }
    log.warn('[ENTRI-WEBHOOK] no secret configured, skipping verification')
  } else {
    const result = verifyEntriSignature(payload.id || '', webhookSecret, {
      signatureV2: c.req.header('Entri-Signature-V2') || '',
      signatureV1: c.req.header('Entri-Signature') || '',
      timestamp: c.req.header('Entri-Timestamp') || '',
    })

    if (!result.valid) {
      if (isProduction) {
        log.warn(
          { version: result.version, error: result.error },
          '[ENTRI-WEBHOOK] signature invalid — rejecting',
        )
        return c.json({ error: 'Invalid signature' }, 401)
      }
      log.warn(
        { version: result.version, error: result.error },
        '[ENTRI-WEBHOOK] signature invalid — allowing in dev mode',
      )
    }
  }

  const eventType = payload.type || payload.event || 'unknown'
  log.info(
    {
      eventType,
      domain: payload.domain,
      propagation_status: payload.propagation_status,
      setup_type: payload.setup_type,
      provider: payload.provider,
      data: payload.data,
    },
    '[ENTRI-WEBHOOK] received',
  )

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Parse userId which may be a JSON string with { projectId, email } from the frontend */
function parseWebhookUserId(rawUserId: string | undefined) {
  if (!rawUserId) return { userIdentifier: null, projectId: null }

  try {
    const parsed = JSON.parse(rawUserId)
    if (parsed && typeof parsed === 'object' && parsed.email) {
      return {
        userIdentifier: parsed.email as string,
        projectId: (parsed.projectId as string) ?? null,
      }
    }
  } catch {
    // Not JSON — treat as plain UUID or email
  }

  return { userIdentifier: rawUserId, projectId: null }
}

/** Resolve a user identifier (UUID or email) to an internal user ID */
async function resolveUserId(userIdentifier: string): Promise<string | null> {
  if (UUID_RE.test(userIdentifier)) {
    const user = await db
      .selectFrom('user')
      .select('id')
      .where('id', '=', userIdentifier)
      .executeTakeFirst()
    return user?.id ?? null
  }
  const user = await db
    .selectFrom('user')
    .select('id')
    .where('email', '=', userIdentifier)
    .executeTakeFirst()
  return user?.id ?? null
}

/** Find a pending domain by name, or by userId+projectId */
async function findPendingDomain(
  domainName: string | null,
  resolvedUserId: string | null,
  projectId: string | null,
) {
  if (domainName) {
    const record = await db
      .selectFrom('domain')
      .selectAll()
      .where('domainName', '=', domainName)
      .where('status', 'in', ['pending', 'purchasing', 'dns_configuring'])
      .orderBy('createdAt', 'desc')
      .executeTakeFirst()
    if (record) return record
  }

  if (!resolvedUserId) return null

  let q = db
    .selectFrom('domain')
    .selectAll()
    .where('userId', '=', resolvedUserId)
    .where('status', 'in', ['pending', 'purchasing', 'dns_configuring'])

  if (projectId) {
    q = q.where('projectId', '=', projectId)
  }

  return q.orderBy('createdAt', 'desc').executeTakeFirst()
}

async function processDomainWebhook(payload: any) {
  // Idempotency: skip if we already processed this event
  if (payload.id) {
    const existing = await db
      .selectFrom('domain_webhook_event')
      .select('status')
      .where('entriEventId', '=', payload.id)
      .where('status', '=', 'processed')
      .executeTakeFirst()

    if (existing) {
      log.info({ eventId: payload.id }, '[ENTRI-WEBHOOK] duplicate event, skipping')
      return
    }
  }

  const eventType = payload.type || payload.event
  const domainName = payload.purchased_domains?.[0] || payload.domain
  const { userIdentifier, projectId: extractedProjectId } = parseWebhookUserId(payload.user_id)

  if (
    eventType === 'domain.added' ||
    eventType === 'domain.purchased' ||
    eventType === 'domainPurchased'
  ) {
    if (!userIdentifier && !domainName) {
      log.warn('[ENTRI-WEBHOOK] no user_id or domain in payload')
      return
    }

    const resolvedUserId = userIdentifier ? await resolveUserId(userIdentifier) : null
    let domainRecord = await findPendingDomain(domainName, resolvedUserId, extractedProjectId)

    const propagationOk =
      payload.propagation_status === 'success' ||
      payload.dns_status === 'configured' ||
      eventType === 'domain.purchased' ||
      eventType === 'domainPurchased'

    const finalDomainName = domainName || domainRecord?.domainName

    if (!finalDomainName) {
      log.warn({ userIdentifier }, '[ENTRI-WEBHOOK] no domain name in payload or record')
      return
    }

    // If no existing domain record, create one (Sell flow doesn't pre-create records)
    if (!domainRecord) {
      if (!resolvedUserId) {
        log.warn({ domainName }, '[ENTRI-WEBHOOK] no domain record and no userId to find project')
        return
      }

      // Use projectId from encoded userId, or fall back to user's most recent project
      const project = extractedProjectId
        ? await db
            .selectFrom('project')
            .select(['id', 'organizationId'])
            .where('id', '=', extractedProjectId)
            .where('userId', '=', resolvedUserId)
            .where('deletedAt', 'is', null)
            .executeTakeFirst()
        : await db
            .selectFrom('project')
            .select(['id', 'organizationId'])
            .where('userId', '=', resolvedUserId)
            .where('deletedAt', 'is', null)
            .orderBy('createdAt', 'desc')
            .executeTakeFirst()

      if (!project) {
        log.warn(
          { userId: resolvedUserId, domainName },
          '[ENTRI-WEBHOOK] no project found for user',
        )
        return
      }

      const now = new Date()
      // Domain expiry: use Entri payload if available, else default to 1 year
      const expiresAt = payload.expiration_date
        ? new Date(payload.expiration_date)
        : payload.registration_years
          ? new Date(
              now.getTime() + Number(payload.registration_years) * 365.25 * 24 * 60 * 60 * 1000,
            )
          : new Date(now.getTime() + 365.25 * 24 * 60 * 60 * 1000)

      // Check if domain name already exists (e.g., from a previous attempt)
      let existingByName = await db
        .selectFrom('domain')
        .select(['id', 'projectId'])
        .where('domainName', '=', finalDomainName)
        .executeTakeFirst()

      let newRecord: { id: string } | undefined

      if (existingByName) {
        // Reuse existing record — update it with new data
        await db
          .updateTable('domain')
          .set({
            projectId: project.id,
            userId: resolvedUserId,
            organizationId: project.organizationId,
            status: propagationOk ? 'ssl_provisioning' : 'dns_configuring',
            registrar: payload.provider || payload.registrar || 'entri',
            entriFlowId: payload.id || null,
            purchasedAt: now,
            expiresAt,
            lastError: null,
            sslMeta: null,
            dnsVerified: propagationOk,
            routingConfigured: propagationOk,
            updatedAt: now,
          })
          .where('id', '=', existingByName.id)
          .execute()
        newRecord = { id: existingByName.id }
      } else {
        newRecord = await db
          .insertInto('domain')
          .values({
            projectId: project.id,
            userId: resolvedUserId,
            organizationId: project.organizationId,
            domainName: finalDomainName,
            status: propagationOk ? 'ssl_provisioning' : 'dns_configuring',
            registrar: payload.provider || payload.registrar || 'entri',
            entriFlowId: payload.id || null,
            purchasedAt: now,
            expiresAt,
            createdAt: now,
            updatedAt: now,
          })
          .returning(['id'])
          .executeTakeFirst()
      }

      // Entri Power handles SSL for both bare and www — no CF custom hostname needed.
      // Just mark DNS as verified and let the health check loop confirm SSL readiness.
      if (propagationOk && newRecord?.id && !existingByName) {
        await db
          .updateTable('domain')
          .set({ dnsVerified: true, routingConfigured: true })
          .where('id', '=', newRecord.id)
          .execute()
        await appendDomainLog(
          newRecord.id,
          'webhook_domain_ready',
          `DNS verified, waiting for Entri Power SSL provisioning`,
          true,
        )
      } else if (newRecord?.id) {
        await appendDomainLog(
          newRecord.id,
          existingByName ? 'webhook_domain_reused' : 'webhook_domain_created',
          `Domain record ${existingByName ? 'reused' : 'created'} (DNS ${propagationOk ? 'ok' : 'pending'})`,
        )
      }

      log.info(
        {
          domainId: newRecord?.id,
          domainName: finalDomainName,
          status: propagationOk ? 'ssl_provisioning' : 'dns_configuring',
        },
        '[ENTRI-WEBHOOK] domain created from webhook',
      )
      return
    }

    // Skip redundant logs when nothing changed (Entri retries propagation checks)
    const statusUnchanged = !propagationOk && domainRecord!.status === 'dns_configuring'

    if (!statusUnchanged) {
      await appendDomainLog(
        domainRecord!.id,
        'webhook_received',
        `Event: ${eventType}, DNS propagation: ${propagationOk ? 'ok' : 'pending'}`,
      )
    }

    // Entri Power handles SSL — no CF custom hostname needed.
    // Just update status and let health check loop confirm SSL readiness.
    const finalStatus = propagationOk ? 'ssl_provisioning' : 'dns_configuring'

    const expiresAt = payload.expiration_date
      ? new Date(payload.expiration_date)
      : payload.registration_years
        ? new Date(Date.now() + Number(payload.registration_years) * 365.25 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000)

    await db
      .updateTable('domain')
      .set({
        domainName: finalDomainName,
        status: finalStatus,
        registrar: payload.provider || payload.registrar || null,
        entriFlowId: payload.id || null,
        routingConfigured: propagationOk,
        dnsVerified: propagationOk,
        lastError: null,
        purchasedAt: new Date(),
        expiresAt,
        updatedAt: new Date(),
      })
      .where('id', '=', domainRecord!.id)
      .execute()

    if (!statusUnchanged) {
      await appendDomainLog(
        domainRecord!.id,
        'status_change',
        `Status → ${finalStatus}`,
        finalStatus === 'ssl_provisioning',
      )
    }

    log.info(
      {
        domainId: domainRecord?.id,
        domainName: finalDomainName,
        status: finalStatus,
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
  } else if (eventType === 'domain.propagation.timeout') {
    // Entri gave up waiting for DNS to propagate — mark domain as error
    const resolvedUserId = userIdentifier ? await resolveUserId(userIdentifier) : null
    const timedOutDomain = await findPendingDomain(domainName, resolvedUserId, extractedProjectId)

    if (timedOutDomain) {
      const failReason =
        'DNS propagation timed out. Please verify your DNS records are configured correctly and retry.'
      await appendDomainLog(timedOutDomain.id, 'propagation_timeout', failReason, false)
      await db
        .updateTable('domain')
        .set({ status: 'error', lastError: failReason, updatedAt: new Date() })
        .where('id', '=', timedOutDomain.id)
        .execute()
      log.warn(
        { domainId: timedOutDomain.id, domainName, userIdentifier },
        '[ENTRI-WEBHOOK] DNS propagation timed out',
      )
    } else {
      log.warn(
        { domainName, userIdentifier },
        '[ENTRI-WEBHOOK] propagation timeout but no matching domain record',
      )
    }

    if (payload.id) {
      await db
        .updateTable('domain_webhook_event')
        .set({ status: 'processed', processedAt: new Date() })
        .where('entriEventId', '=', payload.id)
        .execute()
    }
  } else if (eventType === 'domain.failed' || eventType === 'domainFailed') {
    const failReason =
      payload.error || payload.reason || 'Domain setup failed (provider reported failure)'

    // Find the specific domain that failed using shared lookup
    const resolvedUserId = userIdentifier ? await resolveUserId(userIdentifier) : null
    const failedDomain = await findPendingDomain(domainName, resolvedUserId, extractedProjectId)

    if (failedDomain) {
      await appendDomainLog(failedDomain.id, 'domain_failed', failReason, false)
      await db
        .updateTable('domain')
        .set({ status: 'error', lastError: failReason, updatedAt: new Date() })
        .where('id', '=', failedDomain.id)
        .execute()
    }

    log.warn({ userIdentifier, domainName, eventType }, '[ENTRI-WEBHOOK] domain setup failed')
  } else if (eventType === 'dns.propagated' || eventType === 'dnsConfigured') {
    // DNS propagation complete — wire up Cloudflare
    if (domainName) {
      const domainRecord = await db
        .selectFrom('domain')
        .selectAll()
        .where('domainName', '=', domainName)
        .where('status', '=', 'dns_configuring')
        .executeTakeFirst()

      if (domainRecord) {
        await appendDomainLog(domainRecord.id, 'dns_propagated', 'DNS records verified by provider')
      }

      // Entri Power handles SSL — just mark DNS verified and move to ssl_provisioning
      await db
        .updateTable('domain')
        .set({
          status: 'ssl_provisioning',
          dnsVerified: true,
          routingConfigured: true,
          lastError: null,
          updatedAt: new Date(),
        })
        .where('domainName', '=', domainName)
        .where('status', '=', 'dns_configuring')
        .execute()

      if (domainRecord) {
        await appendDomainLog(
          domainRecord.id,
          'status_change',
          'DNS verified, waiting for Entri Power SSL',
          true,
        )
      }

      log.info({ domainName, status: 'ssl_provisioning' }, '[ENTRI-WEBHOOK] DNS propagated')
    }
  } else if (eventType === 'purchase.confirmation.expired') {
    // User started a purchase but never confirmed/paid
    const resolvedUserId = userIdentifier ? await resolveUserId(userIdentifier) : null

    if (resolvedUserId) {
      const pendingDomain = await db
        .selectFrom('domain')
        .selectAll()
        .where('userId', '=', resolvedUserId)
        .where('status', 'in', ['pending', 'purchasing'])
        .orderBy('createdAt', 'desc')
        .executeTakeFirst()

      if (pendingDomain) {
        await appendDomainLog(
          pendingDomain.id,
          'purchase_expired',
          'Domain purchase was not completed in time. You can try again.',
          false,
        )
        await db
          .updateTable('domain')
          .set({
            status: 'error',
            lastError: 'Purchase was not completed in time. You can try again.',
            updatedAt: new Date(),
          })
          .where('id', '=', pendingDomain.id)
          .execute()
        log.info(
          { domainId: pendingDomain.id, domainName: pendingDomain.domainName, userIdentifier },
          '[ENTRI-WEBHOOK] purchase confirmation expired',
        )
      }
    } else {
      log.info(
        { domainName, userIdentifier },
        '[ENTRI-WEBHOOK] purchase expired but no user to look up',
      )
    }

    if (payload.id) {
      await db
        .updateTable('domain_webhook_event')
        .set({ status: 'processed', processedAt: new Date() })
        .where('entriEventId', '=', payload.id)
        .execute()
    }
  } else {
    log.info({ eventType }, '[ENTRI-WEBHOOK] unhandled event type')
  }
}
