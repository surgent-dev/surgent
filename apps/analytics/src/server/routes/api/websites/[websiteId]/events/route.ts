import { z } from 'zod'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { filterParams, pagingParams, searchParams } from '@/lib/schema'
import { getWebsiteEvents } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().optional(),
    endAt: z.coerce.number().optional(),
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

  const data = await getWebsiteEvents(websiteId, filters)

  return json(data)
}
