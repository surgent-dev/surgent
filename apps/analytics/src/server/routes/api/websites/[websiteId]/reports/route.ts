import { z } from 'zod'
import { parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { filterParams, pagingParams, reportTypeParam } from '@/lib/schema'
import { getReports } from '@/queries/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    ...filterParams,
    ...pagingParams,
    type: reportTypeParam.optional(),
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params
  const { page, pageSize, search, type } = query

  const data = await getReports(
    {
      where: {
        websiteId,
        type,
      },
    },
    {
      page,
      pageSize,
      search,
    },
  )

  return json(data)
}
