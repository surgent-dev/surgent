import { z } from 'zod'
import { uuid } from '@/lib/crypto'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { pagingParams, searchParams } from '@/lib/schema'
import { createWebsite } from '@/queries/prisma'
import { getAllWebsites } from '@/queries/prisma/website'

export async function GET(request: Request) {
  const schema = z.object({
    ...pagingParams,
    ...searchParams,
    externalProjectId: z.uuid().optional(),
    externalOrgId: z.uuid().optional(),
    externalUserId: z.uuid().optional(),
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { externalProjectId, externalOrgId, externalUserId } = query
  const filters = await getQueryFilters(query)
  const where: any = {}

  if (externalProjectId) {
    where.externalProjectId = externalProjectId
  }

  if (externalOrgId) {
    where.externalOrgId = externalOrgId
  }

  if (externalUserId) {
    where.externalUserId = externalUserId
  }

  return json(await getAllWebsites(filters, where))
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().max(100),
    domain: z.string().max(500).nullable().optional(),
    id: z.uuid().nullable().optional(),
    externalProjectId: z.uuid().nullable().optional(),
    externalOrgId: z.uuid().nullable().optional(),
    externalUserId: z.uuid().nullable().optional(),
  })

  const { body, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { id, name, domain, externalProjectId, externalOrgId, externalUserId } = body

  const data: any = {
    id: id ?? uuid(),
    name,
    domain,
  }

  if (externalProjectId) {
    data.externalProjectId = externalProjectId
  }

  if (externalOrgId) {
    data.externalOrgId = externalOrgId
  }

  if (externalUserId) {
    data.externalUserId = externalUserId
  }

  const website = await createWebsite(data)

  return json(website)
}
