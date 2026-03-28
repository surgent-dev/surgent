import { z } from 'zod'
import { parseRequest } from '@/lib/request'
import { json, notFound, ok } from '@/lib/response'
import { anyObjectParam, segmentTypeParam } from '@/lib/schema'
import { deleteSegment, getSegment, updateSegment } from '@/queries/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; segmentId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId, segmentId } = await params

  const segment = await getSegment(segmentId)

  return json(segment)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; segmentId: string }> },
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

  const { websiteId, segmentId } = await params
  const { type, name, parameters } = body

  const segment = await getSegment(segmentId)

  if (!segment) {
    return notFound()
  }

  const result = await updateSegment(segmentId, {
    type,
    name,
    parameters,
  } as any)

  return json(result)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; segmentId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId, segmentId } = await params

  const segment = await getSegment(segmentId)

  if (!segment) {
    return notFound()
  }

  await deleteSegment(segmentId)

  return ok()
}
