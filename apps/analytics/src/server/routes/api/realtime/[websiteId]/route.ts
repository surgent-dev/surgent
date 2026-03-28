import { startOfMinute, subMinutes } from 'date-fns'
import { REALTIME_RANGE } from '@/lib/constants'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { getRealtimeData } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { query, error } = await parseRequest(request)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const filters = await getQueryFilters(
    {
      ...query,
      startAt: subMinutes(startOfMinute(new Date()), REALTIME_RANGE).getTime(),
      endAt: Date.now(),
    },
    websiteId,
  )

  const data = await getRealtimeData(websiteId, filters)

  return json(data)
}
