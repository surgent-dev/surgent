import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { getWebsiteSession } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; sessionId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId, sessionId } = await params

  const data = await getWebsiteSession(websiteId, sessionId)

  return json(data)
}
