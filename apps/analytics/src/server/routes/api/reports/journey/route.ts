import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { reportResultSchema } from '@/lib/schema'
import { getJourney } from '@/queries/sql'

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, reportResultSchema)

  if (error) {
    return error()
  }

  const { websiteId, parameters, filters } = body

  const queryFilters = await getQueryFilters(filters, websiteId)

  const data = await getJourney(websiteId, parameters, queryFilters)

  return json(data)
}
