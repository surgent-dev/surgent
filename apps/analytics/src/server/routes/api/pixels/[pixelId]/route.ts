import { z } from 'zod'
import { parseRequest } from '@/lib/request'
import { badRequest, json, notFound, ok, serverError } from '@/lib/response'
import { deletePixel, getPixel, updatePixel } from '@/queries/prisma'

export async function GET(request: Request, { params }: { params: Promise<{ pixelId: string }> }) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { pixelId } = await params
  const pixel = await getPixel(pixelId)

  if (!pixel) {
    return notFound()
  }

  return json(pixel)
}

export async function POST(request: Request, { params }: { params: Promise<{ pixelId: string }> }) {
  const schema = z.object({
    name: z.string().optional(),
    slug: z.string().min(8).optional(),
    externalProjectId: z.uuid().nullable().optional(),
    externalOrgId: z.uuid().nullable().optional(),
    externalUserId: z.uuid().nullable().optional(),
  })

  const { body, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { pixelId } = await params
  const { name, slug, externalProjectId, externalOrgId, externalUserId } = body

  try {
    const data: any = {}

    if (name !== undefined) {
      data.name = name
    }

    if (slug !== undefined) {
      data.slug = slug
    }

    if (externalProjectId !== undefined) {
      data.externalProjectId = externalProjectId
    }

    if (externalOrgId !== undefined) {
      data.externalOrgId = externalOrgId
    }

    if (externalUserId !== undefined) {
      data.externalUserId = externalUserId
    }

    const pixel = await updatePixel(pixelId, data)

    return json(pixel)
  } catch (e: any) {
    if (e.message.toLowerCase().includes('unique constraint') && e.message.includes('slug')) {
      return badRequest({ message: 'That slug is already taken.' })
    }

    return serverError(e)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ pixelId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { pixelId } = await params
  const pixel = await getPixel(pixelId)

  if (!pixel) {
    return notFound()
  }

  await deletePixel(pixelId)

  return ok()
}
