import type { Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import type { QueryFilters } from '@/lib/types'

export async function findWebsite(criteria: Prisma.WebsiteFindUniqueArgs) {
  return prisma.client.website.findUnique(criteria)
}

export async function getWebsite(websiteId: string) {
  return findWebsite({
    where: {
      id: websiteId,
    },
  })
}

export async function getWebsiteByDomainCandidates(domains: string[]) {
  if (!domains.length) return null

  return prisma.client.website.findFirst({
    where: {
      domain: { in: domains },
      deletedAt: null,
    },
  })
}

export async function getWebsites(criteria: Prisma.WebsiteFindManyArgs, filters: QueryFilters) {
  const { search } = filters
  const { getSearchParameters, pagedQuery } = prisma

  const where: Prisma.WebsiteWhereInput = {
    ...criteria.where,
    ...getSearchParameters(search, [
      {
        name: 'contains',
      },
      { domain: 'contains' },
    ]),
    deletedAt: null,
  }

  return pagedQuery('website', { ...criteria, where }, filters)
}

export async function getAllWebsites(filters?: QueryFilters, where: Prisma.WebsiteWhereInput = {}) {
  return getWebsites(
    {
      where,
    },
    {
      orderBy: 'name',
      ...filters,
    },
  )
}

export async function createWebsite(
  data: Prisma.WebsiteCreateInput | Prisma.WebsiteUncheckedCreateInput,
) {
  return prisma.client.website.create({
    data,
  })
}

export async function updateWebsite(
  websiteId: string,
  data: Prisma.WebsiteUpdateInput | Prisma.WebsiteUncheckedUpdateInput,
) {
  return prisma.client.website.update({
    where: {
      id: websiteId,
    },
    data,
  })
}

export async function resetWebsite(websiteId: string) {
  const { client, transaction } = prisma

  return transaction(
    [
      client.revenue.deleteMany({
        where: { websiteId },
      }),
      client.eventData.deleteMany({
        where: { websiteId },
      }),
      client.sessionData.deleteMany({
        where: { websiteId },
      }),
      client.websiteEvent.deleteMany({
        where: { websiteId },
      }),
      client.session.deleteMany({
        where: { websiteId },
      }),
      client.website.update({
        where: { id: websiteId },
        data: {
          resetAt: new Date(),
        },
      }),
    ],
    {
      timeout: 30000,
    },
  )
}

export async function deleteWebsite(websiteId: string) {
  const { client, transaction } = prisma

  return transaction(
    [
      client.revenue.deleteMany({
        where: { websiteId },
      }),
      client.eventData.deleteMany({
        where: { websiteId },
      }),
      client.sessionData.deleteMany({
        where: { websiteId },
      }),
      client.websiteEvent.deleteMany({
        where: { websiteId },
      }),
      client.session.deleteMany({
        where: { websiteId },
      }),
      client.report.deleteMany({
        where: { websiteId },
      }),
      client.segment.deleteMany({
        where: { websiteId },
      }),
      client.website.delete({
        where: { id: websiteId },
      }),
    ],
    {
      timeout: 30000,
    },
  )
}
