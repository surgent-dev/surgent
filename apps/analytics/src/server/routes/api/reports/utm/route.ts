import { UTM_PARAMS } from '@/lib/constants'
import { getQueryFilters, parseRequest, setWebsiteDate } from '@/lib/request'
import { json } from '@/lib/response'
import { reportResultSchema } from '@/lib/schema'
import { getUTM, type UTMParameters } from '@/queries/sql'

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, reportResultSchema)

  if (error) {
    return error()
  }

  const { websiteId } = body

  const filters = await getQueryFilters(body.filters, websiteId)
  const parameters = await setWebsiteDate(websiteId, body.parameters)

  const data = {
    utm_source: [],
    utm_medium: [],
    utm_campaign: [],
    utm_term: [],
    utm_content: [],
  }

  for (const key of UTM_PARAMS) {
    data[key] = await getUTM(websiteId, { column: key, ...parameters } as UTMParameters, filters)
  }

  return json(data)
}
