import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { getWebsiteDateRange } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const dateRange = await getWebsiteDateRange(websiteId)

  return json(dateRange)
}
