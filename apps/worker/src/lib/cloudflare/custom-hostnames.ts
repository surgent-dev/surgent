/**
 * Cloudflare Custom Hostnames (SSL for SaaS) + KV domain mapping.
 *
 * This module handles the two things needed to connect a custom domain
 * to a deployed user app:
 *
 * 1. **Custom Hostname** — tells Cloudflare to accept traffic for the domain
 *    and provision TLS. The CNAME from the domain (set via Entri)
 *    points to the fallback origin on `surgent.site`, and Cloudflare routes
 *    the traffic to the dispatch worker.
 *
 * 2. **KV mapping** — the dispatch worker needs to know which user worker
 *    script to forward to. We write `domain → scriptName` into a KV namespace
 *    that the dispatch worker reads at the edge.
 *
 * NOTE: Only www subdomains are supported for Custom Hostnames.
 * Bare/root domains cannot use CF Custom Hostnames when A records point
 * to Cloudflare IPs — CF blocks TXT/HTTP validation and requires a CNAME
 * to the SaaS zone, which is impossible for zone apex (RFC 1034).
 */

import Cloudflare from 'cloudflare'
import { config } from '../config'
import { createLogger } from '../logger'

const log = createLogger('cf-custom-hostnames')

function getClient() {
  return new Cloudflare({ apiToken: config.cloudflare.apiToken })
}

// ── Startup validation ───────────────────────────────────────

/**
 * Validate that Cloudflare env vars are set and the API token works.
 * Call once at startup to surface config issues early.
 */
export async function validateCloudflareConfig(): Promise<void> {
  const { zoneId, apiToken, accountId, kvNamespaceId } = config.cloudflare

  const missing: string[] = []
  if (!zoneId) missing.push('CLOUDFLARE_ZONE_ID')
  if (!apiToken) missing.push('CLOUDFLARE_API_TOKEN')
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID')
  if (!kvNamespaceId) missing.push('CLOUDFLARE_DOMAIN_KV_NAMESPACE_ID')

  if (missing.length > 0) {
    log.warn(
      { missing },
      'Cloudflare custom domains config incomplete — custom hostnames will be skipped',
    )
    return
  }

  // Verify the token can access the zone (lightweight GET)
  try {
    const cf = getClient()
    await cf.zones.get({ zone_id: zoneId! })
    log.info('Cloudflare config validated — zone access OK')
  } catch (err: any) {
    log.error(
      { err: err?.message, zoneId },
      'Cloudflare API token cannot access the configured zone. ' +
        'Ensure the token has "Zone > SSL and Certificates > Edit" permission for custom hostnames.',
    )
  }
}

// ── Custom Hostnames (SSL for SaaS) ─────────────────────────

/**
 * Register a custom hostname with Cloudflare so it provisions TLS and
 * routes traffic to the dispatch worker via the fallback origin.
 *
 * Returns the Custom Hostname ID (store as `cfCustomDomainId` in DB).
 */
export async function createCustomHostname(hostname: string): Promise<string> {
  const zoneId = config.cloudflare.zoneId
  if (!zoneId) throw new Error('CLOUDFLARE_ZONE_ID not configured')

  const cf = getClient()

  const result = await cf.customHostnames.create({
    zone_id: zoneId,
    hostname,
    ssl: {
      method: 'http',
      type: 'dv',
      settings: {
        min_tls_version: '1.2',
      },
    },
  })

  log.info({ hostname, customHostnameId: result.id }, 'custom hostname created')
  return result.id!
}

/**
 * Remove a custom hostname from Cloudflare.
 */
export async function deleteCustomHostname(customHostnameId: string): Promise<void> {
  const zoneId = config.cloudflare.zoneId
  if (!zoneId) return

  const cf = getClient()

  await cf.customHostnames.delete(customHostnameId, { zone_id: zoneId })
  log.info({ customHostnameId }, 'custom hostname deleted')
}

// ── KV domain → scriptName mapping ──────────────────────────

const KV_API_BASE = 'https://api.cloudflare.com/client/v4'

/**
 * Write a domain → scriptName mapping to the dispatch worker's KV namespace
 * so it knows which user worker to route custom domain traffic to.
 */
export async function setDomainMapping(domain: string, scriptName: string): Promise<void> {
  const { kvNamespaceId, accountId, apiToken } = config.cloudflare
  if (!kvNamespaceId || !accountId) {
    log.warn('KV namespace or account ID not configured, skipping domain mapping')
    return
  }

  const url = `${KV_API_BASE}/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values/${domain}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'text/plain',
    },
    body: scriptName,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    log.error({ domain, scriptName, status: res.status, body: text }, 'failed to write KV mapping')
    throw new Error(`Failed to write domain KV mapping: ${res.status}`)
  }

  log.info({ domain, scriptName }, 'KV domain mapping written')
}

/**
 * Remove a domain mapping from KV.
 */
export async function deleteDomainMapping(domain: string): Promise<void> {
  const { kvNamespaceId, accountId, apiToken } = config.cloudflare
  if (!kvNamespaceId || !accountId) return

  const url = `${KV_API_BASE}/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values/${domain}`

  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiToken}` },
  })

  log.info({ domain }, 'KV domain mapping deleted')
}

// ── Combined helper ─────────────────────────────────────────

export interface ConnectDomainResult {
  customHostnameId: string | null
  kvMapped: boolean
  error: string | null
}

/**
 * Full wiring: register a CF custom hostname for the www subdomain
 * and write a KV mapping so the dispatch worker routes traffic.
 *
 * Only the www subdomain is registered as a Custom Hostname because
 * bare/root domains with A records pointing to Cloudflare IPs cannot
 * pass CF ownership verification (CF blocks TXT/HTTP validation and
 * requires a CNAME to the SaaS zone, which is invalid at zone apex).
 */
export async function connectCustomDomain(
  domain: string,
  scriptName: string,
): Promise<ConnectDomainResult> {
  let customHostnameId: string | null = null
  let kvMapped = false
  let error: string | null = null

  const wwwDomain = domain.startsWith('www.') ? domain : `www.${domain}`

  // 1. Create Custom Hostname for www subdomain only
  if (config.cloudflare.zoneId) {
    try {
      customHostnameId = await createCustomHostname(wwwDomain)
    } catch (err: any) {
      const msg = err?.message || 'Unknown CF error'
      log.error({ err, hostname: wwwDomain }, 'failed to create custom hostname')
      error = `Custom hostname (${wwwDomain}): ${msg}`
    }
  }

  // 2. Write KV mapping for www
  try {
    await setDomainMapping(wwwDomain, scriptName)
    kvMapped = true
  } catch (err: any) {
    const msg = err?.message || 'Unknown KV error'
    log.error({ err, domain: wwwDomain, scriptName }, 'failed to write KV domain mapping')
    error = error ? `${error}; KV mapping: ${msg}` : `KV mapping: ${msg}`
  }

  return { customHostnameId, kvMapped, error }
}

/**
 * Full teardown: remove custom hostname and KV mapping for www,
 * plus clean up any legacy bare-domain mappings.
 */
export async function disconnectCustomDomain(
  domain: string,
  customHostnameId?: string | null,
): Promise<void> {
  const wwwDomain = domain.startsWith('www.') ? domain : `www.${domain}`
  const bareDomain = domain.startsWith('www.') ? domain.slice(4) : domain

  // Delete the stored custom hostname (www)
  if (customHostnameId) {
    try {
      await deleteCustomHostname(customHostnameId)
    } catch (err) {
      log.error({ err, customHostnameId }, 'failed to delete custom hostname')
    }
  }

  // Clean up any other custom hostnames for this domain (legacy bare domain, etc.)
  if (config.cloudflare.zoneId) {
    const cf = getClient()
    for (const hostname of [bareDomain, wwwDomain]) {
      try {
        const results = await cf.customHostnames.list({
          zone_id: config.cloudflare.zoneId,
          hostname,
        })
        for (const ch of results.result || []) {
          if (ch.id && ch.id !== customHostnameId) {
            await deleteCustomHostname(ch.id)
          }
        }
      } catch (err) {
        log.error({ err, hostname }, 'failed to find/delete custom hostname')
      }
    }
  }

  // Delete KV mappings for both (clean up legacy bare mappings too)
  for (const d of [bareDomain, wwwDomain]) {
    try {
      await deleteDomainMapping(d)
    } catch (err) {
      log.error({ err, domain: d }, 'failed to delete KV domain mapping')
    }
  }
}
