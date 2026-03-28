import { z } from 'zod'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { filterParams } from '@/lib/schema'
import { getEventDataProperties } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().int(),
    endAt: z.coerce.number().int(),
    ...filterParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const filters = await getQueryFilters(query, websiteId)

  const data = await getEventDataProperties(websiteId, filters)

  return json(data)
}
