import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { getEventData } from '@/queries/sql/events/getEventData'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; eventId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId, eventId } = await params

  const data = await getEventData(websiteId, eventId)

  return json(data)
}
