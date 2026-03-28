import { getQueryFilters, parseRequest, setWebsiteDate } from '@/lib/request'
import { json } from '@/lib/response'
import { reportResultSchema } from '@/lib/schema'
import { getRevenue, type RevenuParameters } from '@/queries/sql/reports/getRevenue'

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, reportResultSchema)

  if (error) {
    return error()
  }

  const { websiteId } = body

  const parameters = await setWebsiteDate(websiteId, body.parameters)
  const filters = await getQueryFilters(body.filters, websiteId)

  const data = await getRevenue(websiteId, parameters as RevenuParameters, filters)

  return json(data)
}
