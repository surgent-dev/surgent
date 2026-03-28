import { getQueryFilters, parseRequest, setWebsiteDate } from '@/lib/request'
import { json } from '@/lib/response'
import { reportResultSchema } from '@/lib/schema'
import { type GoalParameters, getGoal } from '@/queries/sql/reports/getGoal'

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, reportResultSchema)

  if (error) {
    return error()
  }

  const { websiteId } = body

  const parameters = await setWebsiteDate(websiteId, body.parameters)
  const filters = await getQueryFilters(body.filters, websiteId)

  const data = await getGoal(websiteId, parameters as GoalParameters, filters)

  return json(data)
}
