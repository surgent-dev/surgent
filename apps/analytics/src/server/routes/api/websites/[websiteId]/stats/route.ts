import { z } from 'zod'
import { getCompareDate } from '@/lib/date'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { dateRangeParams, filterParams } from '@/lib/schema'
import { getWebsiteStats } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    ...dateRangeParams,
    ...filterParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const filters = await getQueryFilters(query, websiteId)
  const compare = query.compare === 'yoy' ? 'yoy' : 'prev'

  const data = await getWebsiteStats(websiteId, filters)

  const { startDate, endDate } = getCompareDate(compare, filters.startDate, filters.endDate)

  const comparison = await getWebsiteStats(websiteId, {
    ...filters,
    startDate,
    endDate,
  })

  return json({ ...data, comparison })
}
