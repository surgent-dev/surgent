import { config } from '@/lib/config'
import { createLogger } from '@/lib/logger'
import * as ProjectService from '@/services/projects'

const log = createLogger('analytics')

interface AnalyticsWebsite {
  id: string
  domain: string | null
}

interface AnalyticsWebsitePage {
  data: AnalyticsWebsite[]
}

function getAnalyticsUrl() {
  if (config.analytics.url) return config.analytics.url
  throw new Error('ANALYTICS_URL is not configured')
}

function analyticsHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  if (config.analytics.token) headers.set('Authorization', `Bearer ${config.analytics.token}`)
  return headers
}

function normalizeAnalyticsDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined

  try {
    return new URL(domain).hostname.toLowerCase()
  } catch {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/\.$/, '')
  }
}

async function findAnalyticsWebsite(projectId: string): Promise<AnalyticsWebsite | null> {
  const url = new URL('/api/websites', getAnalyticsUrl())
  url.searchParams.set('externalProjectId', projectId)

  const res = await fetch(url, { headers: analyticsHeaders() })
  if (!res.ok) {
    throw new Error(`Failed to lookup analytics website (${res.status})`)
  }

  const body = (await res.json()) as AnalyticsWebsitePage
  return body.data[0] ?? null
}

async function createAnalyticsWebsite(args: {
  projectId: string
  organizationId: string
  userId: string
  name: string
  domain?: string
}): Promise<AnalyticsWebsite> {
  const domain = normalizeAnalyticsDomain(args.domain)

  const res = await fetch(`${getAnalyticsUrl()}/api/websites`, {
    method: 'POST',
    headers: analyticsHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: args.name,
      domain: domain || null,
      externalProjectId: args.projectId,
      externalOrgId: args.organizationId,
      externalUserId: args.userId,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to create analytics website (${res.status})`)
  }

  return (await res.json()) as AnalyticsWebsite
}

async function updateAnalyticsWebsite(websiteId: string, domain: string) {
  const normalized = normalizeAnalyticsDomain(domain)
  const res = await fetch(`${getAnalyticsUrl()}/api/websites/${websiteId}`, {
    method: 'POST',
    headers: analyticsHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ domain: normalized || null }),
  })

  if (!res.ok) {
    throw new Error(`Failed to update analytics website (${res.status})`)
  }
}

async function ensureAnalyticsWebsite(args: {
  projectId: string
  organizationId: string
  userId: string
  name: string
  domain?: string
}): Promise<AnalyticsWebsite> {
  const domain = normalizeAnalyticsDomain(args.domain)
  const website = await findAnalyticsWebsite(args.projectId)
  if (website?.id) {
    if (domain && website.domain !== domain) {
      await updateAnalyticsWebsite(website.id, domain)
    }
    log.info({ projectId: args.projectId, websiteId: website.id }, 'analytics connected')
    return website
  }

  const created = await createAnalyticsWebsite({ ...args, domain })
  if (!created.id) throw new Error('Analytics website response missing id')

  log.info({ projectId: args.projectId, websiteId: created.id }, 'analytics connected')
  return created
}

export async function ensureAnalytics(args: {
  projectId: string
  organizationId: string
  userId: string
  name: string
  domain?: string
}): Promise<AnalyticsWebsite | null> {
  try {
    return await ensureAnalyticsWebsite(args)
  } catch (err) {
    log.warn({ err, projectId: args.projectId }, 'analytics unavailable')
    return null
  }
}

export async function getAnalyticsWebsite(projectId: string): Promise<AnalyticsWebsite | null> {
  return findAnalyticsWebsite(projectId)
}

export async function syncProjectAnalyticsDomain(projectId: string): Promise<void> {
  try {
    const website = await getAnalyticsWebsite(projectId)
    if (!website?.id) return

    const primary = await ProjectService.getActivePrimaryDomainByProjectId(projectId)
    const worker = await ProjectService.getWorkerByProjectId(projectId)
    const domain = primary?.domainName || worker?.hostname || undefined
    if (!domain) return

    await updateAnalyticsWebsite(website.id, domain)
  } catch (err) {
    log.warn({ err, projectId }, 'analytics domain sync unavailable')
  }
}

export async function removeAnalytics(projectId: string): Promise<void> {
  try {
    const website = await getAnalyticsWebsite(projectId)
    if (!website?.id) return

    const res = await fetch(`${getAnalyticsUrl()}/api/websites/${website.id}`, {
      method: 'DELETE',
      headers: analyticsHeaders(),
    })

    if (!res.ok) {
      throw new Error(`Failed to remove analytics website (${res.status})`)
    }
  } catch (err) {
    log.warn({ err, projectId }, 'analytics removal unavailable')
  }
}
