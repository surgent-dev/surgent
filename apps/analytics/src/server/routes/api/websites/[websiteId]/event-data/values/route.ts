import { z } from 'zod'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { filterParams } from '@/lib/schema'
import { getEventDataValues } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().int(),
    endAt: z.coerce.number().int(),
    event: z.string(),
    propertyName: z.string(),
    ...filterParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const { propertyName } = query
  const filters = await getQueryFilters(query, websiteId)

  const data = await getEventDataValues(websiteId, {
    ...filters,
    propertyName,
  })

  return json(data)
}
