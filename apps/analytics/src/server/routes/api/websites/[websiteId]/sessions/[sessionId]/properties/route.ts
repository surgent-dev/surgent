import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { getSessionData } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; sessionId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId, sessionId } = await params

  const data = await getSessionData(websiteId, sessionId)

  return json(data)
}
