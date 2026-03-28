import { config } from '@/lib/config'
import { createLogger } from '@/lib/logger'
import * as ProjectService from '@/services/projects'

const log = createLogger('analytics')

interface AnalyticsWebsite {
  id: string
  domain: string | null
}

interface AnalyticsWebsiteList {
  data?: AnalyticsWebsite[]
}

function getAnalyticsUrl() {
  if (config.analytics.url) return config.analytics.url
  throw new Error('ANALYTICS_URL is not configured')
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

  const res = await fetch(url)
  if (!res.ok) {
    log.warn({ projectId, status: res.status }, 'failed to lookup analytics website')
    return null
  }

  const body = (await res.json()) as AnalyticsWebsiteList | AnalyticsWebsite[]
  if (Array.isArray(body)) return body[0] || null
  if (Array.isArray(body.data)) return body.data[0] || null
  return null
}

async function createAnalyticsWebsite(args: {
  projectId: string
  organizationId: string
  userId: string
  name: string
  domain?: string
}): Promise<AnalyticsWebsite | null> {
  const domain = normalizeAnalyticsDomain(args.domain)

  const res = await fetch(`${getAnalyticsUrl()}/api/websites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: args.name,
      domain: domain || null,
      externalProjectId: args.projectId,
      externalOrgId: args.organizationId,
      externalUserId: args.userId,
    }),
  })

  if (!res.ok) {
    log.warn(
      { projectId: args.projectId, status: res.status },
      'failed to create analytics website',
    )
    return null
  }

  return (await res.json()) as AnalyticsWebsite
}

async function updateAnalyticsWebsite(websiteId: string, domain: string) {
  const normalized = normalizeAnalyticsDomain(domain)
  const res = await fetch(`${getAnalyticsUrl()}/api/websites/${websiteId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: normalized || null }),
  })

  if (!res.ok) {
    log.warn({ websiteId, status: res.status }, 'failed to update analytics website')
  }
}

export async function ensureAnalytics(args: {
  projectId: string
  organizationId: string
  userId: string
  name: string
  domain?: string
}): Promise<AnalyticsWebsite | null> {
  try {
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
    if (!created?.id) return null

    log.info({ projectId: args.projectId, websiteId: created.id }, 'analytics connected')
    return created
  } catch (err) {
    log.warn({ err, projectId: args.projectId }, 'analytics service unavailable — skipping')
    return null
  }
}

export async function getAnalyticsWebsite(projectId: string): Promise<AnalyticsWebsite | null> {
  try {
    return await findAnalyticsWebsite(projectId)
  } catch (err) {
    log.warn({ err, projectId }, 'failed to resolve analytics website')
    return null
  }
}

export async function syncProjectAnalyticsDomain(projectId: string): Promise<void> {
  const website = await getAnalyticsWebsite(projectId)
  if (!website?.id) return

  const primary = await ProjectService.getActivePrimaryDomainByProjectId(projectId)
  const worker = await ProjectService.getWorkerByProjectId(projectId)
  const domain = primary?.domainName || worker?.hostname || undefined
  if (!domain) return

  await updateAnalyticsWebsite(website.id, domain)
}

export async function removeAnalytics(projectId: string): Promise<void> {
  const website = await getAnalyticsWebsite(projectId)
  if (!website?.id) return

  try {
    await fetch(`${getAnalyticsUrl()}/api/websites/${website.id}`, {
      method: 'DELETE',
    })
  } catch (err) {
    log.warn({ err, projectId, websiteId: website.id }, 'failed to remove analytics website')
  }
}
