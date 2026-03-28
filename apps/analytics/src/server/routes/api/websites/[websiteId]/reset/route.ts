import { parseRequest } from '@/lib/request'
import { ok } from '@/lib/response'
import { resetWebsite } from '@/queries/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  await resetWebsite(websiteId)

  return ok()
}
