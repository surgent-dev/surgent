import { Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import type { QueryFilters } from '@/lib/types'

import ReportFindManyArgs = Prisma.ReportFindManyArgs

async function findReport(criteria: Prisma.ReportFindUniqueArgs) {
  return prisma.client.report.findUnique(criteria)
}

async function getReportOwner(websiteId: string) {
  return prisma.client.website.findUnique({
    where: {
      id: websiteId,
    },
    select: {
      deletedAt: true,
      externalOrgId: true,
      externalProjectId: true,
      externalUserId: true,
    },
  })
}

export async function getReport(reportId: string) {
  return findReport({
    where: {
      id: reportId,
    },
  })
}

export async function getReports(criteria: ReportFindManyArgs, filters: QueryFilters = {}) {
  const { search } = filters

  const where: Prisma.ReportWhereInput = {
    ...criteria.where,
    ...prisma.getSearchParameters(search, [
      { name: 'contains' },
      { description: 'contains' },
      { type: 'contains' },
      {
        website: {
          name: 'contains',
        },
      },
      {
        website: {
          domain: 'contains',
        },
      },
    ]),
  }

  return prisma.pagedQuery('report', { ...criteria, where }, filters)
}

export async function resolveReportOwnership(
  websiteId: string,
  ownership: {
    externalProjectId?: string | null
    externalOrgId?: string | null
    externalUserId?: string | null
  } = {},
  fallbackOwnership: {
    externalProjectId?: string | null
    externalOrgId?: string | null
    externalUserId?: string | null
  } = {},
) {
  const owner = await getReportOwner(websiteId)

  if (!owner || owner.deletedAt) {
    return null
  }

  return {
    externalProjectId:
      ownership.externalProjectId !== undefined
        ? (ownership.externalProjectId ?? null)
        : fallbackOwnership.externalProjectId !== undefined
          ? (fallbackOwnership.externalProjectId ?? null)
          : owner.externalProjectId || null,
    externalOrgId:
      ownership.externalOrgId !== undefined
        ? (ownership.externalOrgId ?? null)
        : fallbackOwnership.externalOrgId !== undefined
          ? (fallbackOwnership.externalOrgId ?? null)
          : owner.externalOrgId || null,
    externalUserId:
      ownership.externalUserId !== undefined
        ? (ownership.externalUserId ?? null)
        : fallbackOwnership.externalUserId !== undefined
          ? (fallbackOwnership.externalUserId ?? null)
          : owner.externalUserId || null,
  }
}

export async function createReport(data: Prisma.ReportUncheckedCreateInput) {
  return prisma.client.report.create({ data })
}

export async function updateReport(reportId: string, data: any) {
  return prisma.client.report.update({ where: { id: reportId }, data })
}

export async function deleteReport(reportId: string) {
  return prisma.client.report.delete({ where: { id: reportId } })
}
