import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql } from 'kysely'
import { requireAuth } from '@/middleware/auth'
import { db } from '@/lib/db'
import { generateEntriToken } from '@/lib/entri/jwt'
import { getDomainProvider, expandDomainQuery } from '@/lib/domains'
import { connectCustomDomain, disconnectCustomDomain } from '@/lib/cloudflare/custom-hostnames'
import { config } from '@/lib/config'
import { HttpError } from '@/lib/errors'
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

/** Quick health check: can we reach the domain over HTTPS? */
async function checkDomainHealth(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    return res.status < 500
  } catch {
    return false
  }
}

// ─── SSL provisioning metadata (stored in lastError as JSON) ────

interface SslProvisioningMeta {
  _type: 'ssl_provisioning_meta'
  attempts: number
  firstAttemptAt: string
  lastAttemptAt: string
}

function parseSslMeta(lastError: string | null): SslProvisioningMeta | null {
  if (!lastError) return null
  try {
    const parsed = JSON.parse(lastError)
    if (parsed?._type === 'ssl_provisioning_meta') return parsed
  } catch {}
  return null
}

function serializeSslMeta(meta: SslProvisioningMeta): string {
  return JSON.stringify(meta)
}

/**
 * Backoff interval between SSL health checks.
 *   1-20 attempts (~first minute): every poll (3s)
 *   21-40 (~2 min): every 10s
 *   41-80 (~7 min): every 30s
 *   81+: every 60s
 */
function getSslCheckInterval(attempts: number): number {
  if (attempts <= 20) return 0
  if (attempts <= 40) return 10_000
  if (attempts <= 80) return 30_000
  return 60_000
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

/** Check if the TXT verification record exists for a domain. */
async function verifyDomainTxt(domain: string, projectId: string): Promise<boolean> {
  const expected = `surgent-verify=${generateVerifyToken(projectId)}`
  const host = `_surgent-verify.${domain.replace(/^www\./, '')}`
  try {
    const { resolve } = await import('dns/promises')
    const records = await resolve(host, 'TXT')
    return records.some((r) => r.join('') === expected)
  } catch {
    return false
  }
}

const domains = new Hono<AppContext>()

// ─── Auth-protected routes ───────────────────────────────────

domains.use('/*', requireAuth)

/**
 * POST /api/domains/check-availability
 * Check if a domain is available for purchase.
 * Uses the configured domain provider (entri or namecheap).
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
 * - Entri: returns JWT + config to launch the Entri modal on the frontend
 * - Namecheap: registers the domain server-side and sets DNS records
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
      .where('status', 'in', ['active', 'ssl_provisioning', 'purchasing', 'dns_configuring'])
      .executeTakeFirst()

    if (existingDomain) {
      throw new HttpError(409, 'Project already has a domain')
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

    const provider = await getDomainProvider()

    // ── Namecheap: register server-side ──────────────────────
    if (provider.name === 'namecheap') {
      if (!suggestedDomain) throw new HttpError(400, 'Domain name is required')

      // Create pending domain record
      const now = new Date()
      const domain = await db
        .insertInto('domain')
        .values({
          projectId,
          userId: user.id,
          organizationId: session.activeOrganizationId,
          domainName: suggestedDomain,
          status: 'purchasing',
          createdAt: now,
          updatedAt: now,
        })
        .returning(['id'])
        .executeTakeFirst()

      await appendDomainLog(
        domain!.id,
        'purchase_started',
        `Purchasing ${suggestedDomain} via Namecheap`,
      )
      log.info(
        { projectId, domainId: domain?.id, suggestedDomain, provider: 'namecheap' },
        'domain purchase started',
      )

      try {
        const result = await provider.registerDomain(suggestedDomain, 1, {
          firstName: user.name?.split(' ')[0] || 'Domain',
          lastName: user.name?.split(' ').slice(1).join(' ') || 'Owner',
          address1: '123 Main St',
          city: 'San Francisco',
          stateProvince: 'CA',
          postalCode: '94105',
          country: 'US',
          phone: '+1.5555555555',
          email: user.email,
        })

        if (!result.registered) {
          await db
            .updateTable('domain')
            .set({ status: 'error', updatedAt: new Date() })
            .where('id', '=', domain!.id)
            .execute()
          throw new HttpError(500, 'Domain registration failed')
        }

        // Set DNS records at the registrar
        try {
          await provider.setDnsRecords(suggestedDomain, dnsRecords)
        } catch (dnsErr) {
          log.warn({ err: dnsErr, suggestedDomain }, 'DNS setup failed, domain still purchased')
        }

        // Connect to Cloudflare: custom hostname + KV dispatch mapping
        let cfCustomDomainId: string | null = null
        let kvMapped = false
        let lastError: string | null = null

        if (worker?.scriptName) {
          await appendDomainLog(
            domain!.id,
            'cloudflare_connect_start',
            `Connecting ${suggestedDomain} → ${worker.scriptName}`,
          )
          const result = await connectCustomDomain(suggestedDomain, worker.scriptName)
          cfCustomDomainId = result.customHostnameId
          kvMapped = result.kvMapped
          lastError = result.error
          await appendDomainLog(
            domain!.id,
            'cloudflare_connect_done',
            result.error || 'Connected successfully',
            !result.error,
          )
        }

        const finalStatus = kvMapped ? 'active' : worker?.scriptName ? 'error' : 'dns_configuring'

        await db
          .updateTable('domain')
          .set({
            status: finalStatus,
            registrar: 'namecheap',
            cfCustomDomainId,
            kvMapped,
            lastError,
            purchasedAt: new Date(),
            updatedAt: new Date(),
          })
          .where('id', '=', domain!.id)
          .execute()

        await appendDomainLog(
          domain!.id,
          'status_change',
          `Status set to ${finalStatus}`,
          finalStatus === 'active',
        )

        return c.json({
          domainId: domain!.id,
          domainName: suggestedDomain,
          provider: 'namecheap',
          registered: true,
          dnsRecords,
        })
      } catch (err) {
        if (err instanceof HttpError) throw err
        log.error({ err, suggestedDomain }, 'namecheap registration error')
        await db
          .updateTable('domain')
          .set({ status: 'error', updatedAt: new Date() })
          .where('id', '=', domain!.id)
          .execute()
        throw new HttpError(500, 'Domain registration failed')
      }
    }

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

    // Check if project already has an active/pending domain
    const existingDomain = await db
      .selectFrom('domain')
      .select('id')
      .where('projectId', '=', projectId)
      .where('status', 'in', ['active', 'ssl_provisioning', 'purchasing', 'dns_configuring'])
      .executeTakeFirst()

    if (existingDomain) {
      throw new HttpError(409, 'Project already has a domain')
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

    const token = await generateEntriToken(user.id)

    // Create domain record in dns_configuring state (no purchase needed)
    const now = new Date()
    const domainRecord = await db
      .insertInto('domain')
      .values({
        projectId,
        userId: user.id,
        organizationId: session.activeOrganizationId,
        domainName: domain,
        status: 'dns_configuring',
        registrar: 'entri-connect',
        createdAt: now,
        updatedAt: now,
      })
      .returning(['id'])
      .executeTakeFirst()

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

  // Auto-promote: move dns_configuring domains forward.
  // Don't wait for webhook — do a live health check to detect readiness.
  const configuringDomains = result.filter((d) => d.status === 'dns_configuring')
  for (const d of configuringDomains) {
    if (d.kvMapped) continue // already promoted

    if (d.dnsVerified) {
      // Webhook confirmed DNS — go straight to ssl_provisioning
      await db
        .updateTable('domain')
        .set({ status: 'ssl_provisioning', kvMapped: true, lastError: null, updatedAt: new Date() })
        .where('id', '=', d.id)
        .execute()
      d.status = 'ssl_provisioning'
      await appendDomainLog(d.id, 'auto_promote', 'DNS verified by webhook, checking SSL', true)
      log.info({ domainId: d.id, domainName: d.domainName }, 'auto-promoted to ssl_provisioning')
      continue
    }

    // No webhook yet — do a live check to avoid waiting
    const bareDomain = d.domainName.replace(/^www\./, '')
    const bareOk = await checkDomainHealth(bareDomain)
    if (bareOk) {
      // Domain is resolving — promote past dns_configuring
      await db
        .updateTable('domain')
        .set({
          status: 'ssl_provisioning',
          dnsVerified: true,
          kvMapped: true,
          lastError: null,
          updatedAt: new Date(),
        })
        .where('id', '=', d.id)
        .execute()
      d.status = 'ssl_provisioning'
      d.dnsVerified = true
      await appendDomainLog(d.id, 'auto_promote', 'DNS resolving (live check), checking SSL', true)
      log.info({ domainId: d.id, domainName: d.domainName }, 'auto-promoted via live DNS check')
    }
  }

  // SSL health check with backoff: never hard-fail, keep checking with decreasing frequency
  // Use current d.status (may have been updated by auto-promote above)
  const provisioningDomains = result.filter((d) => d.status === 'ssl_provisioning')
  for (const d of provisioningDomains) {
    const meta = parseSslMeta(d.lastError) ?? {
      _type: 'ssl_provisioning_meta' as const,
      attempts: 0,
      firstAttemptAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
    }

    // Throttle: skip if not enough time since last check
    const timeSinceUpdate = Date.now() - new Date(d.updatedAt).getTime()
    const interval = getSslCheckInterval(meta.attempts)
    if (timeSinceUpdate < interval) continue

    meta.attempts += 1
    meta.lastAttemptAt = new Date().toISOString()

    // Check both bare and www — don't mark active until both have valid SSL
    const bareDomain = d.domainName.replace(/^www\./, '')
    const bareOk = await checkDomainHealth(bareDomain)
    const wwwOk = bareOk ? await checkDomainHealth(`www.${bareDomain}`) : false

    if (bareOk && wwwOk) {
      // Verify TXT ownership record (non-blocking — log result but don't gate activation)
      const txtOk = d.projectId ? await verifyDomainTxt(bareDomain, d.projectId) : false
      if (!txtOk) {
        log.warn(
          { domainId: d.id, domainName: bareDomain },
          'TXT verification missing — activating anyway',
        )
      }

      await db
        .updateTable('domain')
        .set({ status: 'active', lastError: null, updatedAt: new Date() })
        .where('id', '=', d.id)
        .execute()
      d.status = 'active'
      d.lastError = null
      await appendDomainLog(
        d.id,
        'ssl_provisioned',
        `Domain is live with SSL (attempt ${meta.attempts}${txtOk ? ', TXT verified' : ', TXT not found'})`,
        true,
      )
    } else {
      // Not ready yet — update meta and keep trying
      const serialized = serializeSslMeta(meta)
      await db
        .updateTable('domain')
        .set({ lastError: serialized, updatedAt: new Date() })
        .where('id', '=', d.id)
        .execute()
      d.lastError = serialized

      // Log periodically (every 10th attempt)
      if (meta.attempts % 10 === 0) {
        const elapsedMin = Math.round(
          (Date.now() - new Date(meta.firstAttemptAt).getTime()) / 60_000,
        )
        await appendDomainLog(
          d.id,
          'ssl_check',
          `Still provisioning after ${elapsedMin}m (${meta.attempts} checks, bare=${bareOk ? 'ok' : 'no'} www=${wwwOk ? 'ok' : 'no'})`,
          false,
        )
      }
    }
  }

  return c.json({
    domains: result.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      domainName: d.domainName,
      status: d.status,
      registrar: d.registrar,
      dnsVerified: d.dnsVerified,
      kvMapped: d.kvMapped,
      lastError: d.lastError,
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
          lastError: serializeSslMeta(freshMeta),
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
const ENTRI_PRODUCTION_IP = '3.14.77.245'

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
      if (isProduction && result.version) {
        log.warn(
          { version: result.version, error: result.error },
          '[ENTRI-WEBHOOK] signature rejected',
        )
        return c.json({ error: 'Invalid signature' }, 401)
      }
      log.warn(
        { version: result.version, error: result.error },
        '[ENTRI-WEBHOOK] signature invalid, continuing',
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
      const newRecord = await db
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
          createdAt: now,
          updatedAt: now,
        })
        .returning(['id', 'projectId'])
        .executeTakeFirst()

      // Entri Power handles SSL for both bare and www — no CF custom hostname needed.
      // Just mark DNS as verified and let the health check loop confirm SSL readiness.
      if (propagationOk && newRecord?.id) {
        await db
          .updateTable('domain')
          .set({ dnsVerified: true, kvMapped: true })
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
          'webhook_domain_created',
          `Domain record created (DNS ${propagationOk ? 'ok' : 'pending'})`,
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

    await db
      .updateTable('domain')
      .set({
        domainName: finalDomainName,
        status: finalStatus,
        registrar: payload.provider || payload.registrar || null,
        entriFlowId: payload.id || null,
        kvMapped: propagationOk,
        dnsVerified: propagationOk,
        lastError: null,
        purchasedAt: new Date(),
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
          kvMapped: true,
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
  } else {
    log.info({ eventType }, '[ENTRI-WEBHOOK] unhandled event type')
  }
}
