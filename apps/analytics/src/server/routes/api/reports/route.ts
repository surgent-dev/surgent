import { z } from 'zod'
import { uuid } from '@/lib/crypto'
import { parseRequest } from '@/lib/request'
import { json, notFound } from '@/lib/response'
import { pagingParams, reportSchema, reportTypeParam } from '@/lib/schema'
import { createReport, getReports, resolveReportOwnership } from '@/queries/prisma'

const createReportSchema = reportSchema.extend({
  externalProjectId: z.uuid().nullable().optional(),
  externalOrgId: z.uuid().nullable().optional(),
  externalUserId: z.uuid().nullable().optional(),
})

export async function GET(request: Request) {
  const schema = z.object({
    websiteId: z.uuid(),
    type: reportTypeParam.optional(),
    ...pagingParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { page, search, pageSize, websiteId, type } = query
  const filters = {
    page,
    pageSize,
    search,
  }

  const data = await getReports(
    {
      where: {
        websiteId,
        type,
        website: {
          deletedAt: null,
        },
      },
    },
    filters,
  )

  return json(data)
}

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, createReportSchema)

  if (error) {
    return error()
  }

  const {
    websiteId,
    type,
    name,
    description,
    parameters,
    externalProjectId,
    externalOrgId,
    externalUserId,
  } = body
  const ownership = await resolveReportOwnership(websiteId, {
    externalProjectId,
    externalOrgId,
    externalUserId,
  })

  if (!ownership) {
    return notFound()
  }

  const result = await createReport({
    id: uuid(),
    websiteId,
    externalProjectId: ownership.externalProjectId,
    externalOrgId: ownership.externalOrgId,
    externalUserId: ownership.externalUserId,
    type,
    name,
    description: description || '',
    parameters,
  } as any)

  return json(result)
}
