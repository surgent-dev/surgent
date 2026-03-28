import { z } from 'zod'
import { uuid } from '@/lib/crypto'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { pagingParams, searchParams } from '@/lib/schema'
import { createPixel, getAllPixels } from '@/queries/prisma'

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

  return json(await getAllPixels(filters, where))
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().max(100),
    slug: z.string().max(100),
    externalProjectId: z.uuid().nullable().optional(),
    externalOrgId: z.uuid().nullable().optional(),
    externalUserId: z.uuid().nullable().optional(),
    id: z.uuid().nullable().optional(),
  })

  const { body, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { id, name, slug, externalProjectId, externalOrgId, externalUserId } = body

  const result = await createPixel({
    id: id ?? uuid(),
    name,
    slug,
    externalProjectId,
    externalOrgId,
    externalUserId,
  } as any)

  return json(result)
}
