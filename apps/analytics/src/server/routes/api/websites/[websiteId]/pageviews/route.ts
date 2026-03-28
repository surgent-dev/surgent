import { z } from 'zod'
import { getCompareDate } from '@/lib/date'
import { getQueryFilters, parseRequest } from '@/lib/request'
import { json } from '@/lib/response'
import { normalizeTimeSeries } from '@/lib/series'
import { dateRangeParams, filterParams } from '@/lib/schema'
import { getPageviewStats, getSessionStats } from '@/queries/sql'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    ...dateRangeParams,
    ...filterParams,
  })

  const { query, error } = await parseRequest(request, schema)

  if (error) {
    return error()
  }

  const { websiteId } = await params

  const filters = await getQueryFilters(query, websiteId)

  const [pageviewData, sessionData] = await Promise.all([
    getPageviewStats(websiteId, filters),
    getSessionStats(websiteId, filters),
  ])

  const pageviews = normalizeTimeSeries(pageviewData, filters)
  const sessions = normalizeTimeSeries(sessionData, filters)

  if (filters.compare) {
    const { startDate: compareStartDate, endDate: compareEndDate } = getCompareDate(
      filters.compare,
      filters.startDate,
      filters.endDate,
    )

    const compareFilters = {
      ...filters,
      startDate: compareStartDate,
      endDate: compareEndDate,
    }

    const [comparePageviewData, compareSessionData] = await Promise.all([
      getPageviewStats(websiteId, compareFilters),
      getSessionStats(websiteId, compareFilters),
    ])

    const comparePageviews = normalizeTimeSeries(comparePageviewData, compareFilters)
    const compareSessions = normalizeTimeSeries(compareSessionData, compareFilters)

    return json({
      pageviews,
      sessions,
      startDate: filters.startDate,
      endDate: filters.endDate,
      compare: {
        pageviews: comparePageviews,
        sessions: compareSessions,
        startDate: compareStartDate,
        endDate: compareEndDate,
      },
    })
  }

  return json({ pageviews, sessions })
}
