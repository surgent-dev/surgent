import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { getActiveVisitors } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const visitors = await getActiveVisitors(websiteId)

  return json(visitors)
}
