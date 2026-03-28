import { z } from 'zod'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { dateRangeParams, filterParams, pagingParams, searchParams } from '@/lib/schema'
import { getWebsiteSessions } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    ...dateRangeParams,
    ...filterParams,
    ...pagingParams,
    ...searchParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const filters = await getQueryFilters(query, websiteId)

  const data = await getWebsiteSessions(websiteId, filters)

  return json(data)
}
