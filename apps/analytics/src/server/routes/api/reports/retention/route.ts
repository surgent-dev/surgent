import { getQueryFilters, parseRequest, setWebsiteDate } from '@/lib/request'
import { json } from '@/lib/response'
import { reportResultSchema } from '@/lib/schema'
import { getRetention, type RetentionParameters } from '@/queries/sql'

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, reportResultSchema)

  if (error) {
    return error()
  }

  const { websiteId } = body

  const filters = await getQueryFilters(body.filters, websiteId)
  const parameters = await setWebsiteDate(websiteId, body.parameters)

  const data = await getRetention(websiteId, parameters as RetentionParameters, filters)

  return json(data)
}
