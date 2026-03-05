/**
 * Cloudflare Custom Hostnames (SSL for SaaS) + KV domain mapping.
 *
 * This module handles the two things needed to connect a purchased domain
 * to a deployed user app:
 *
 * 1. **Custom Hostname** — tells Cloudflare to accept traffic for the domain
 *    and provision TLS. The CNAME from the domain (set at Namecheap/Entri)
 *    points to the fallback origin on `surgent.site`, and Cloudflare routes
 *    the traffic to the dispatch worker.
 *
 * 2. **KV mapping** — the dispatch worker needs to know which user worker
 *    script to forward to. We write `domain → scriptName` into a KV namespace
 *    that the dispatch worker reads at the edge.
 */

import Cloudflare from 'cloudflare'
import { config } from '../config'
import { createLogger } from '../logger'

const log = createLogger('cf-custom-hostnames')

function getClient() {
  return new Cloudflare({ apiToken: config.cloudflare.apiToken })
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
 * Full wiring: register the custom hostname with Cloudflare AND write the
 * KV mapping so the dispatch worker can route traffic.
 */
export async function connectCustomDomain(
  domain: string,
  scriptName: string,
): Promise<ConnectDomainResult> {
  let customHostnameId: string | null = null
  let kvMapped = false
  let error: string | null = null

  // 1. Create Custom Hostname (if zone is configured)
  if (config.cloudflare.zoneId) {
    try {
      customHostnameId = await createCustomHostname(domain)
    } catch (err: any) {
      const msg = err?.message || 'Unknown CF error'
      log.error({ err, domain }, 'failed to create custom hostname (continuing with KV only)')
      error = `Custom hostname: ${msg}`
    }
  }

  // 2. Write KV mapping (dispatch worker routing)
  try {
    await setDomainMapping(domain, scriptName)
    kvMapped = true
  } catch (err: any) {
    const msg = err?.message || 'Unknown KV error'
    log.error({ err, domain, scriptName }, 'failed to write KV domain mapping')
    error = error ? `${error}; KV mapping: ${msg}` : `KV mapping: ${msg}`
  }

  return { customHostnameId, kvMapped, error }
}

/**
 * Full teardown: remove the custom hostname and KV mapping.
 */
export async function disconnectCustomDomain(
  domain: string,
  customHostnameId?: string | null,
): Promise<void> {
  if (customHostnameId) {
    try {
      await deleteCustomHostname(customHostnameId)
    } catch (err) {
      log.error({ err, customHostnameId }, 'failed to delete custom hostname')
    }
  }

  try {
    await deleteDomainMapping(domain)
  } catch (err) {
    log.error({ err, domain }, 'failed to delete KV domain mapping')
  }
}
