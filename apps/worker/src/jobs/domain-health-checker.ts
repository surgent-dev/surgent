import { db } from '@/lib/db'
import { sql } from 'kysely'
import { createLogger } from '@/lib/logger'

const log = createLogger('domain-health-checker')

async function checkDomainHealth(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
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

interface SslProvisioningMeta {
  _type: 'ssl_provisioning_meta'
  attempts: number
  firstAttemptAt: string
  lastAttemptAt: string
}

function getSslCheckInterval(attempts: number): number {
  if (attempts <= 20) return 0
  if (attempts <= 40) return 10_000
  if (attempts <= 80) return 30_000
  return 60_000
}

async function appendDomainLog(
  domainId: string,
  event: string,
  detail?: string,
  success?: boolean,
) {
  const entry = {
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

// Prevent overlapping runs
let running = false

/**
 * Runs every 10 seconds via setInterval.
 * Promotes domains through the lifecycle: dns_configuring -> ssl_provisioning -> active
 *
 * Single query, single pass — no double-processing.
 */
export async function runDomainHealthChecks() {
  if (running) return
  running = true

  try {
    // Fetch all domains that need processing in ONE query
    const domains = await db
      .selectFrom('domain')
      .selectAll()
      .where('status', 'in', ['dns_configuring', 'ssl_provisioning'])
      .execute()

    for (const d of domains) {
      // ── dns_configuring: try to promote to ssl_provisioning ──
      if (d.status === 'dns_configuring') {
        if (d.routingConfigured) continue

        if (d.dnsVerified) {
          await db
            .updateTable('domain')
            .set({
              status: 'ssl_provisioning',
              routingConfigured: true,
              lastError: null,
              updatedAt: new Date(),
            })
            .where('id', '=', d.id)
            .execute()
          await appendDomainLog(d.id, 'auto_promote', 'DNS verified by webhook, checking SSL', true)
          log.info(
            { domainId: d.id, domainName: d.domainName },
            'auto-promoted to ssl_provisioning',
          )
          // Don't process SSL in the same cycle — wait for the next tick
          continue
        }

        const bareDomain = d.domainName.replace(/^www\./, '')
        const bareOk = await checkDomainHealth(bareDomain)
        if (bareOk) {
          await db
            .updateTable('domain')
            .set({
              status: 'ssl_provisioning',
              dnsVerified: true,
              routingConfigured: true,
              lastError: null,
              updatedAt: new Date(),
            })
            .where('id', '=', d.id)
            .execute()
          await appendDomainLog(
            d.id,
            'auto_promote',
            'DNS resolving (live check), checking SSL',
            true,
          )
          log.info({ domainId: d.id, domainName: d.domainName }, 'auto-promoted via live DNS check')
        }
        // Either way, don't fall through to ssl_provisioning check
        continue
      }

      // ── ssl_provisioning: try to promote to active ──
      const meta: SslProvisioningMeta = (d.sslMeta as SslProvisioningMeta) ?? {
        _type: 'ssl_provisioning_meta',
        attempts: 0,
        firstAttemptAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
      }

      // Throttle based on backoff
      const timeSinceUpdate = Date.now() - new Date(d.updatedAt).getTime()
      const interval = getSslCheckInterval(meta.attempts)
      if (timeSinceUpdate < interval) continue

      meta.attempts += 1
      meta.lastAttemptAt = new Date().toISOString()

      const bareDomain = d.domainName.replace(/^www\./, '')
      const bareOk = await checkDomainHealth(bareDomain)
      const wwwOk = bareOk ? await checkDomainHealth(`www.${bareDomain}`) : false

      if (bareOk && wwwOk) {
        await db
          .updateTable('domain')
          .set({ status: 'active', sslMeta: null, lastError: null, updatedAt: new Date() })
          .where('id', '=', d.id)
          .execute()

        const elapsedMs = Date.now() - new Date(meta.firstAttemptAt).getTime()
        const elapsedMin = Math.round(elapsedMs / 60_000)

        await appendDomainLog(
          d.id,
          'ssl_provisioned',
          `Domain is live with SSL (attempt ${meta.attempts}, ${elapsedMin}m)`,
          true,
        )

        log.info(
          {
            domainId: d.id,
            domainName: d.domainName,
            projectId: d.projectId,
            event: 'domain.activated',
            sslAttempts: meta.attempts,
            provisioningDurationMs: elapsedMs,
            provisioningDurationMin: elapsedMin,
          },
          'domain is now active',
        )
      } else {
        await db
          .updateTable('domain')
          .set({ sslMeta: meta as any, updatedAt: new Date() })
          .where('id', '=', d.id)
          .execute()

        if (meta.attempts % 10 === 0) {
          const elapsedMin = Math.round(
            (Date.now() - new Date(meta.firstAttemptAt).getTime()) / 60_000,
          )
          await appendDomainLog(
            d.id,
            'ssl_check',
            `Still provisioning after ${elapsedMin}m (${meta.attempts} checks, bare=${bareOk ? 'ok' : 'no'} www=${wwwOk ? 'ok' : 'no'})`,
          )
        }
      }
    }
  } catch (err) {
    log.error({ err }, 'domain health check cycle failed')
  } finally {
    running = false
  }
}
