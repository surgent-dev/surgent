import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql } from 'kysely'
import { requireAuth } from '@/middleware/auth'
import { db } from '@/lib/db'
import { generateEntriToken } from '@/lib/entri/jwt'
import { expandDomainQuery } from '@/lib/domains'
import { checkAvailability } from '@/lib/entri/client'
import { config } from '@/lib/config'
import { HttpError } from '@/lib/errors'
import { rateLimit } from '@/middleware/rate-limit'
import { createLogger } from '@/lib/logger'
import type { AppContext } from '@/types/application'
import type { DomainLogEntry, DomainStatus, SslProvisioningMeta } from '@repo/db'
import { syncProjectAnalyticsDomain } from '@/services/analytics'

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

interface EntriWebhookPayload {
  id?: string
  type?: string
  event?: string
  job_id?: string
  jobId?: string
  domain?: string
  purchased_domains?: string[]
  user_id?: string
  provider?: string
  registrar?: string
  setup_type?: string
  propagation_status?: string
  secure_status?: string
  power_status?: string
  free_domain?: boolean
  cname_target?: string
  expiration_date?: string
  registration_years?: number | string
  error?: string
  reason?: string
  dns_status?: string
  data?: Record<string, unknown>
}

const TRANSITIONAL_DOMAIN_STATUSES: DomainStatus[] = [
  'pending',
  'purchasing',
  'dns_configuring',
  'ssl_provisioning',
]

function normalizeProviderStatus(value: string | undefined): string | null {
  if (!value) return null
  return value.toLowerCase()
}

function getWebhookJobId(payload: EntriWebhookPayload): string | null {
  return payload.job_id || payload.jobId || null
}

function summarizeDomainWebhookPayload(payload: EntriWebhookPayload): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      id: payload.id,
      type: payload.type,
      event: payload.event,
      jobId: getWebhookJobId(payload),
      domain: payload.domain || payload.purchased_domains?.[0],
      provider: payload.provider,
      registrar: payload.registrar,
      setupType: payload.setup_type,
      propagationStatus: payload.propagation_status,
      secureStatus: payload.secure_status,
      powerStatus: payload.power_status,
      freeDomain: payload.free_domain,
      dnsStatus: payload.dns_status,
      error: payload.error,
      reason: payload.reason,
    }).filter(([, value]) => value !== undefined),
  )
}

function isProviderReady(value: string | null): boolean {
  return value === 'success' || value === 'exempt'
}

function buildSslProvisioningMeta(existing?: SslProvisioningMeta | null): SslProvisioningMeta {
  const now = new Date().toISOString()
  if (existing?._type === 'ssl_provisioning_meta') {
    return {
      ...existing,
      attempts: existing.attempts + 1,
      lastAttemptAt: now,
    }
  }
  return {
    _type: 'ssl_provisioning_meta',
    attempts: 1,
    firstAttemptAt: now,
    lastAttemptAt: now,
  }
}

function deriveDomainStatus(
  payload: EntriWebhookPayload,
  state: {
    propagationStatus: string | null
    secureStatus: string | null
    powerStatus: string | null
  },
): DomainStatus {
  if (
    payload.type === 'domain.propagation.timeout' ||
    payload.event === 'domain.propagation.timeout'
  ) {
    return 'error'
  }

  if (payload.type === 'domain.failed' || payload.event === 'domainFailed') {
    return 'error'
  }

  if (
    state.propagationStatus === 'failed' ||
    state.secureStatus === 'failed' ||
    state.powerStatus === 'failed'
  ) {
    return 'error'
  }

  if (state.propagationStatus !== 'success') {
    return 'dns_configuring'
  }

  const requiresPower = payload.setup_type === 'power' || state.powerStatus !== null
  const secureReady = isProviderReady(state.secureStatus)
  const powerReady = !requiresPower || isProviderReady(state.powerStatus)

  if (secureReady && powerReady) {
    return 'active'
  }

  return 'ssl_provisioning'
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

    // Expand bare queries (e.g. "coolapp") into multiple TLDs.
    // If the query already has a dot (e.g. "coolapp.com"), check just that one.
    const domainsToCheck = domain.includes('.') ? [domain] : expandDomainQuery(domain)
    const results = await Promise.all(domainsToCheck.map((name) => checkAvailability(name)))

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

    // Wipe all non-active domains for this project — one process at a time
    await db
      .deleteFrom('domain')
      .where('projectId', '=', projectId)
      .where('status', '!=', 'active')
      .execute()

    const activeDomainCount = await db
      .selectFrom('domain')
      .select(db.fn.count('id').as('count'))
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    if (Number(activeDomainCount?.count ?? 0) >= 5) {
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
        .where('freeDomain', '=', true)
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

    // Entri Power: apex A record proxied by Entri
    const applicationUrl = `https://${worker.scriptName}.${deployDomain}`

    const dnsRecords = [
      { type: 'A', host: '@', value: '{ENTRI_SERVERS}', ttl: 300, applicationUrl },
    ]

    // ── Entri: return config for frontend modal ──────────────
    // Don't create a DB record yet — the webhook will create/update it
    // when the purchase completes. This avoids stale "pending" records
    // if the user closes the modal without buying.
    const token = await generateEntriToken(user.id)

    log.info(
      { projectId, suggestedDomain, freeDomain: Boolean(freeDomain) },
      'domain purchase initialized (Entri modal)',
    )

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

domains.post(
  '/bind-entri-flow',
  zValidator(
    'json',
    z.object({
      projectId: z.string().uuid(),
      entriFlowId: z.string().min(1).max(255),
      domain: z.string().min(3).max(255),
      domainId: z.string().uuid().optional(),
      freeDomain: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const user = c.get('user')!
    const session = c.get('session')!
    const payload = c.req.valid('json')
    const { projectId, entriFlowId, domainId, freeDomain } = payload
    const domain = payload.domain.replace(/^www\./i, '')

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

    const existingPrimary = await db
      .selectFrom('domain')
      .select(['id'])
      .where('projectId', '=', projectId)
      .where('isPrimary', '=', true)
      .where('status', 'in', ['active', 'ssl_provisioning', 'purchasing', 'dns_configuring'])
      .executeTakeFirst()

    if (domainId) {
      const record = await db
        .selectFrom('domain')
        .selectAll()
        .where('id', '=', domainId)
        .where('projectId', '=', projectId)
        .where('userId', '=', user.id)
        .executeTakeFirst()

      if (!record) throw new HttpError(404, 'Domain not found')

      await db
        .updateTable('domain')
        .set({
          domainName: domain,
          entriFlowId,
          freeDomain: freeDomain ?? record.freeDomain,
          updatedAt: new Date(),
        })
        .where('id', '=', domainId)
        .execute()

      await appendDomainLog(domainId, 'entri_flow_bound', `Linked Entri flow for ${domain}`)
      return c.json({ ok: true, domainId })
    }

    const existingDomain = await db
      .selectFrom('domain')
      .selectAll()
      .where('domainName', '=', domain)
      .executeTakeFirst()

    if (existingDomain?.projectId && existingDomain.projectId !== projectId) {
      throw new HttpError(409, 'Domain is already connected to another project')
    }

    if (existingDomain) {
      await db
        .updateTable('domain')
        .set({
          entriFlowId,
          freeDomain: freeDomain ?? existingDomain.freeDomain,
          updatedAt: new Date(),
        })
        .where('id', '=', existingDomain.id)
        .execute()

      await appendDomainLog(
        existingDomain.id,
        'entri_flow_bound',
        `Linked Entri flow for ${domain}`,
      )
      return c.json({ ok: true, domainId: existingDomain.id })
    }

    const now = new Date()
    const record = await db
      .insertInto('domain')
      .values({
        projectId,
        userId: user.id,
        organizationId: project.organizationId,
        domainName: domain,
        status: 'purchasing',
        registrar: 'entri',
        entriFlowId,
        freeDomain: Boolean(freeDomain),
        isPrimary: !existingPrimary,
        createdAt: now,
        updatedAt: now,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    await appendDomainLog(record.id, 'purchase_started', `Purchase started for ${domain}`)
    return c.json({ ok: true, domainId: record.id })
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

    // Block if another user/project owns this domain (any state)
    const existingDomain = await db
      .selectFrom('domain')
      .select(['id', 'projectId', 'status', 'userId'])
      .where('domainName', '=', domain)
      .executeTakeFirst()

    if (existingDomain && existingDomain.projectId !== projectId) {
      throw new HttpError(409, 'Domain is already in use by another project')
    }

    // Wipe all non-active domains for THIS project only — one process at a time
    await db
      .deleteFrom('domain')
      .where('projectId', '=', projectId)
      .where('status', '!=', 'active')
      .execute()

    const activeDomainCount = await db
      .selectFrom('domain')
      .select(db.fn.count('id').as('count'))
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    if (Number(activeDomainCount?.count ?? 0) >= 5) {
      throw new HttpError(409, 'Maximum 5 domains per project')
    }

    const hasActivePrimary = await db
      .selectFrom('domain')
      .select('id')
      .where('projectId', '=', projectId)
      .where('isPrimary', '=', true)
      .where('status', '=', 'active')
      .executeTakeFirst()

    const isPrimary = !hasActivePrimary

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

    // Entri Power: apex A record proxied by Entri
    const applicationUrl = `https://${worker.scriptName}.${deployDomain}`

    const dnsRecords = [
      { type: 'A', host: '@', value: '{ENTRI_SERVERS}', ttl: 300, applicationUrl },
    ]

    const token = await generateEntriToken(user.id)

    const now = new Date()
    const domainRecord = await db
      .insertInto('domain')
      .values({
        projectId,
        userId: user.id,
        organizationId: project.organizationId,
        domainName: domain,
        status: 'dns_configuring',
        registrar: 'entri-connect',
        isPrimary,
        createdAt: now,
        updatedAt: now,
      })
      .returning(['id', 'status'])
      .executeTakeFirstOrThrow()

    await appendDomainLog(domainRecord!.id, 'connect_initiated', `DNS setup started for ${domain}`)

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

  return c.json({
    domains: result.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      domainName: d.domainName,
      status: d.status,
      registrar: d.registrar,
      isPrimary: d.isPrimary,
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

    if (!['dns_configuring', 'error'].includes(domainRecord.status)) {
      throw new HttpError(400, 'Domain is not in a retryable state')
    }

    const worker = await db
      .selectFrom('worker')
      .select(['scriptName'])
      .where('projectId', '=', projectId)
      .executeTakeFirst()

    if (!worker?.scriptName) {
      throw new HttpError(400, 'Deploy your app before adding a custom domain')
    }

    const deployDomain = config.cloudflare.deployDomain

    const applicationUrl = `https://${worker.scriptName}.${deployDomain}`

    const dnsRecords = [
      { type: 'A', host: '@', value: '{ENTRI_SERVERS}', ttl: 300, applicationUrl },
    ]

    const token = await generateEntriToken(user.id)

    await db
      .updateTable('domain')
      .set({
        status: 'dns_configuring',
        propagationStatus: null,
        secureStatus: null,
        powerStatus: null,
        lastError: null,
        sslMeta: null,
        updatedAt: new Date(),
      })
      .where('id', '=', domainId)
      .execute()

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
 * Remove a domain record.
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

  await db.deleteFrom('domain').where('id', '=', domainId).execute()
  await syncProjectAnalyticsDomain(projectId)

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

    await syncProjectAnalyticsDomain(projectId)

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
        propagationStatus: 'success',
        secureStatus: 'success',
        powerStatus: 'success',
        lastWebhookAt: new Date(),
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
  let payload: EntriWebhookPayload
  try {
    payload = JSON.parse(body) as EntriWebhookPayload
  } catch {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  if (!payload || typeof payload !== 'object') {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  if (!payload.id) {
    return c.json({ error: 'Missing webhook id' }, 400)
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
    const result = verifyEntriSignature(payload.id, webhookSecret, {
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
    },
    '[ENTRI-WEBHOOK] received',
  )

  // Store webhook event
  const existingEvent = await db
    .selectFrom('domain_webhook_event')
    .select(['status'])
    .where('entriEventId', '=', payload.id)
    .executeTakeFirst()

  if (existingEvent?.status === 'processed') {
    log.info({ eventId: payload.id }, '[ENTRI-WEBHOOK] duplicate event, skipping')
    return c.json({ received: true }, 202)
  }

  if (payload.id && existingEvent) {
    await db
      .updateTable('domain_webhook_event')
      .set({ status: 'pending', error: null, processedAt: null })
      .where('entriEventId', '=', payload.id)
      .execute()
  } else {
    // Duplicate check already handled above (existingEvent query), just insert
    await db
      .insertInto('domain_webhook_event')
      .values({
        entriEventId: payload.id,
        eventType,
        domainName: payload.domain || payload.purchased_domains?.[0] || null,
        payload: summarizeDomainWebhookPayload(payload),
        status: 'pending',
      })
      .execute()
  }

  // Process synchronously (domain events are low volume)
  try {
    await processDomainWebhook(payload)
    await markWebhookEventStatus(payload.id, 'processed')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed'
    await markWebhookEventStatus(payload.id, 'failed', message)
    log.error({ err, eventType }, '[ENTRI-WEBHOOK] processing error')
    return c.json({ error: 'Webhook processing failed' }, 500)
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

async function markWebhookEventStatus(
  entriEventId: string | null,
  status: 'processed' | 'failed',
  error?: string,
) {
  if (!entriEventId) return

  await db
    .updateTable('domain_webhook_event')
    .set({
      status,
      error: error || null,
      processedAt: new Date(),
    })
    .where('entriEventId', '=', entriEventId)
    .execute()
}

/** Find a domain record by webhook correlation data. */
async function findDomainRecord(
  domainName: string | null,
  entriFlowId: string | null,
  statuses?: DomainStatus[],
) {
  if (entriFlowId) {
    let q = db.selectFrom('domain').selectAll().where('entriFlowId', '=', entriFlowId)

    if (statuses) {
      q = q.where('status', 'in', statuses)
    }

    const record = await q.orderBy('updatedAt', 'desc').executeTakeFirst()
    if (record) return record
  }

  if (domainName) {
    let q = db.selectFrom('domain').selectAll().where('domainName', '=', domainName)

    if (statuses) {
      q = q.where('status', 'in', statuses)
    }

    const record = await q.orderBy('updatedAt', 'desc').executeTakeFirst()
    if (record) return record
  }

  return null
}

async function processDomainWebhook(payload: EntriWebhookPayload) {
  const eventType = payload.type || payload.event
  const domainName = payload.purchased_domains?.[0] || payload.domain
  const entriFlowId = getWebhookJobId(payload)
  const { userIdentifier, projectId: extractedProjectId } = parseWebhookUserId(payload.user_id)
  const resolvedUserId = userIdentifier ? await resolveUserId(userIdentifier) : null

  const propagationStatus =
    normalizeProviderStatus(payload.propagation_status) ||
    (payload.dns_status === 'configured' ||
    eventType === 'dns.propagated' ||
    eventType === 'dnsConfigured'
      ? 'success'
      : null)
  const secureStatus = normalizeProviderStatus(payload.secure_status)
  const powerStatus = normalizeProviderStatus(payload.power_status)

  const state = {
    propagationStatus,
    secureStatus,
    powerStatus,
  }

  const explicitError =
    eventType === 'domain.propagation.timeout'
      ? 'DNS propagation timed out. Please verify your DNS records are configured correctly and retry.'
      : eventType === 'domain.failed' || eventType === 'domainFailed'
        ? payload.error || payload.reason || 'Domain setup failed (provider reported failure)'
        : state.propagationStatus === 'failed' ||
            state.secureStatus === 'failed' ||
            state.powerStatus === 'failed'
          ? payload.error || payload.reason || 'Domain setup failed (provider reported failure)'
          : null

  if (eventType === 'purchase.confirmation.expired') {
    if (!resolvedUserId) {
      log.info(
        { domainName, userIdentifier },
        '[ENTRI-WEBHOOK] purchase expired but no user to look up',
      )
      return
    }

    const pendingDomain = await findDomainRecord(domainName || null, entriFlowId, [
      'pending',
      'purchasing',
    ])

    if (!pendingDomain) return

    const failReason = 'Purchase was not completed in time. You can try again.'
    await appendDomainLog(pendingDomain.id, 'purchase_expired', failReason, false)
    await db
      .updateTable('domain')
      .set({
        status: 'error',
        lastError: failReason,
        lastWebhookAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', pendingDomain.id)
      .execute()
    return
  }

  if (explicitError) {
    const failedDomain = await findDomainRecord(domainName || null, entriFlowId, [
      ...TRANSITIONAL_DOMAIN_STATUSES,
      'error',
    ])

    if (!failedDomain) {
      log.warn(
        { domainName, userIdentifier, eventType, entriFlowId },
        '[ENTRI-WEBHOOK] failure event but no matching domain record',
      )
      return
    }

    await appendDomainLog(failedDomain.id, 'domain_failed', explicitError, false)
    await db
      .updateTable('domain')
      .set({
        status: 'error',
        entriFlowId: entriFlowId || failedDomain.entriFlowId,
        propagationStatus,
        secureStatus,
        powerStatus,
        cnameTarget: payload.cname_target || failedDomain.cnameTarget,
        lastWebhookAt: new Date(),
        lastError: explicitError,
        sslMeta: null,
        updatedAt: new Date(),
      })
      .where('id', '=', failedDomain.id)
      .execute()
    return
  }

  if (!domainName && !resolvedUserId) {
    log.warn('[ENTRI-WEBHOOK] no user_id or domain in payload')
    return
  }

  let domainRecord = await findDomainRecord(domainName || null, entriFlowId)

  if (domainRecord) {
    if (resolvedUserId && domainRecord.userId !== resolvedUserId) {
      log.warn(
        { domainName, entriFlowId, owner: domainRecord.userId, resolvedUserId },
        '[ENTRI-WEBHOOK] refusing to update domain owned by another user',
      )
      return
    }

    if (
      extractedProjectId &&
      domainRecord.projectId &&
      domainRecord.projectId !== extractedProjectId
    ) {
      log.warn(
        { domainName, entriFlowId, projectId: domainRecord.projectId, extractedProjectId },
        '[ENTRI-WEBHOOK] refusing to update domain owned by another project',
      )
      return
    }
  }

  const finalDomainName = domainName || domainRecord?.domainName
  if (!finalDomainName) {
    log.warn({ userIdentifier, entriFlowId }, '[ENTRI-WEBHOOK] no domain name in payload or record')
    return
  }

  if (!domainRecord) {
    if (!resolvedUserId) {
      log.warn({ domainName }, '[ENTRI-WEBHOOK] no domain record and no userId to find project')
      return
    }

    if (!extractedProjectId) {
      throw new Error('Webhook missing project correlation')
    }

    const project = await db
      .selectFrom('project')
      .select(['id', 'organizationId'])
      .where('id', '=', extractedProjectId)
      .where('userId', '=', resolvedUserId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()

    if (!project) {
      throw new Error('Webhook project correlation did not match an active project')
    }
    const projectId = project.id!

    const existingByName = await db
      .selectFrom('domain')
      .select(['id', 'projectId', 'userId'])
      .where('domainName', '=', finalDomainName)
      .executeTakeFirst()

    if (
      existingByName &&
      (existingByName.projectId !== projectId || existingByName.userId !== resolvedUserId)
    ) {
      log.warn(
        { domainName: finalDomainName, projectId: existingByName.projectId, resolvedUserId },
        '[ENTRI-WEBHOOK] refusing to reuse domain owned by another project',
      )
      return
    }

    const now = new Date()
    const expiresAt = payload.expiration_date
      ? new Date(payload.expiration_date)
      : payload.registration_years
        ? new Date(
            now.getTime() + Number(payload.registration_years) * 365.25 * 24 * 60 * 60 * 1000,
          )
        : null

    const status = deriveDomainStatus(payload, state)
    const sslMeta = status === 'ssl_provisioning' ? buildSslProvisioningMeta(null) : null

    if (existingByName) {
      await db
        .updateTable('domain')
        .set({
          projectId,
          userId: resolvedUserId,
          organizationId: project.organizationId,
          domainName: finalDomainName,
          status,
          registrar: payload.provider || payload.registrar || 'entri',
          entriFlowId,
          propagationStatus,
          secureStatus,
          powerStatus,
          cnameTarget: payload.cname_target || null,
          freeDomain: Boolean(payload.free_domain),
          lastWebhookAt: now,
          purchasedAt: now,
          expiresAt,
          lastError: null,
          sslMeta: sslMeta as any,
          updatedAt: now,
        })
        .where('id', '=', existingByName.id)
        .execute()

      domainRecord = await db
        .selectFrom('domain')
        .selectAll()
        .where('id', '=', existingByName.id)
        .executeTakeFirstOrThrow()
    } else {
      const existingPrimary = await db
        .selectFrom('domain')
        .select('id')
        .where('projectId', '=', projectId)
        .where('isPrimary', '=', true)
        .where('status', 'in', ['active', 'ssl_provisioning', 'purchasing', 'dns_configuring'])
        .executeTakeFirst()

      domainRecord = await db
        .insertInto('domain')
        .values({
          projectId,
          userId: resolvedUserId,
          organizationId: project.organizationId,
          domainName: finalDomainName,
          status,
          registrar: payload.provider || payload.registrar || 'entri',
          entriFlowId,
          propagationStatus,
          secureStatus,
          powerStatus,
          cnameTarget: payload.cname_target || null,
          freeDomain: Boolean(payload.free_domain),
          isPrimary: !existingPrimary,
          lastWebhookAt: now,
          purchasedAt: now,
          expiresAt,
          sslMeta: sslMeta as any,
          createdAt: now,
          updatedAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    }

    await appendDomainLog(
      domainRecord.id,
      'webhook_domain_created',
      `Status → ${status}`,
      status !== 'error',
    )
    if (status === 'active' && domainRecord.isPrimary && domainRecord.projectId) {
      await syncProjectAnalyticsDomain(domainRecord.projectId)
    }
    return
  }

  const status = deriveDomainStatus(payload, state)
  const now = new Date()
  const expiresAt = payload.expiration_date
    ? new Date(payload.expiration_date)
    : payload.registration_years
      ? new Date(now.getTime() + Number(payload.registration_years) * 365.25 * 24 * 60 * 60 * 1000)
      : domainRecord.expiresAt
  const lastError =
    status === 'error' ? payload.error || payload.reason || domainRecord.lastError : null
  const sslMeta =
    status === 'ssl_provisioning'
      ? buildSslProvisioningMeta(domainRecord.sslMeta as SslProvisioningMeta | null)
      : null
  const statusChanged = domainRecord.status !== status

  await db
    .updateTable('domain')
    .set({
      domainName: finalDomainName,
      status,
      registrar: payload.provider || payload.registrar || domainRecord.registrar,
      entriFlowId: entriFlowId || domainRecord.entriFlowId,
      propagationStatus,
      secureStatus,
      powerStatus,
      cnameTarget: payload.cname_target || domainRecord.cnameTarget,
      freeDomain: payload.free_domain ?? domainRecord.freeDomain,
      lastWebhookAt: now,
      purchasedAt:
        domainRecord.purchasedAt ||
        (eventType === 'domain.purchased' || eventType === 'domainPurchased' ? now : null),
      expiresAt,
      lastError,
      sslMeta: sslMeta as any,
      updatedAt: now,
    })
    .where('id', '=', domainRecord.id)
    .execute()

  if (status === 'active' && domainRecord.isPrimary && domainRecord.projectId) {
    await syncProjectAnalyticsDomain(domainRecord.projectId)
  }

  if (statusChanged) {
    await appendDomainLog(
      domainRecord.id,
      'status_change',
      `Status → ${status}`,
      status !== 'error',
    )
    return
  }

  await appendDomainLog(domainRecord.id, 'webhook_received', `Event: ${eventType}`)
}
