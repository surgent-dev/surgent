import { z } from 'zod'
import { parseRequest } from '@/lib/request'
import { json, ok, serverError } from '@/lib/response'
import { deleteWebsite, getWebsite, updateWebsite } from '@/queries/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const website = await getWebsite(websiteId)

  return json(website)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    name: z.string().optional(),
    domain: z.string().nullable().optional(),
    externalProjectId: z.uuid().nullable().optional(),
    externalOrgId: z.uuid().nullable().optional(),
    externalUserId: z.uuid().nullable().optional(),
  })

  const { body, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params
  const { name, domain, externalProjectId, externalOrgId, externalUserId } = body

  try {
    const data: any = {}

    if (name !== undefined) {
      data.name = name
    }

    if (domain !== undefined) {
      data.domain = domain
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

    const website = await updateWebsite(websiteId, data)

    return json(website)
  } catch (e: any) {
    return serverError(e)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  await deleteWebsite(websiteId)

  return ok()
}
