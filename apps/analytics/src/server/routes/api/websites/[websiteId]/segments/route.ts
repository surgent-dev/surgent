import { z } from 'zod'
import { uuid } from '@/lib/crypto'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { anyObjectParam, searchParams, segmentTypeParam } from '@/lib/schema'
import { createSegment, getWebsiteSegments } from '@/queries/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    type: segmentTypeParam,
    ...searchParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params
  const { type } = query

  const filters = await getQueryFilters(query)

  const segments = await getWebsiteSegments(websiteId, type, filters)

  return json(segments)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    type: segmentTypeParam,
    name: z.string().max(200),
    parameters: anyObjectParam,
  })

  const { body, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params
  const { type, name, parameters } = body

  const result = await createSegment({
    id: uuid(),
    websiteId,
    type,
    name,
    parameters,
  } as any)

  return json(result)
}
