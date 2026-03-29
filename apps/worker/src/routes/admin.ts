import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import { requireAdmin } from '@/middleware/admin'
import { getAdminOpsJobs, getAdminOpsOverview, isJobState } from '@/services/admin-ops'

const admin = new Hono<AppContext>()

type Range = 'today' | 'week' | 'this_month' | 'month' | 'year' | '12mo'

function getStart(range: string): { range: Range; start: Date } {
  const now = new Date()
  if (range === 'week') {
    return { range, start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
  }
  if (range === 'this_month') {
    return { range, start: new Date(now.getFullYear(), now.getMonth(), 1) }
  }
  if (range === 'month') {
    return { range, start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
  }
  if (range === 'year') {
    return { range, start: new Date(now.getFullYear(), 0, 1) }
  }
  if (range === '12mo') {
    return { range, start: new Date(now.getFullYear(), now.getMonth() - 11, 1) }
  }
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { range: 'today', start }
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function generateDaysBetween(start: Date, end: Date): string[] {
  const days: string[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(23, 59, 59, 999)
  while (current <= endDate) {
    days.push(dateKey(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

function generateMonthsBetween(start: Date, end: Date): string[] {
  const months: string[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (current <= endMonth) {
    months.push(monthKey(current))
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

function useMonthlyBuckets(range: Range): boolean {
  return range === 'year' || range === '12mo'
}

admin.get('/overview', requireAdmin, async (c) => {
  const { range, start } = getStart(c.req.query('range') || 'today')
  const page = Math.max(1, Number(c.req.query('page')) || 1)
  const perPage = Math.min(Math.max(1, Number(c.req.query('perPage')) || 25), 100)
  const sort = c.req.query('sort') === 'asc' ? 'asc' : 'desc'
  const deployed = c.req.query('deployed') === 'true' || c.req.query('deployed') === '1'
  const offset = (page - 1) * perPage
  const now = new Date()

  const [totalUsers, totalProjects, usersInRange] = await Promise.all([
    db
      .selectFrom('user')
      .select(({ fn }) => fn.countAll().as('count'))
      .executeTakeFirst(),
    db
      .selectFrom('project')
      .select(({ fn }) => fn.countAll().as('count'))
      .where('deletedAt', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('user')
      .select(({ fn }) => fn.countAll().as('count'))
      .where('createdAt', '>=', start)
      .executeTakeFirst(),
  ])

  const projectsCountQuery = db
    .selectFrom('project')
    .select(({ fn }) => fn.countAll().as('count'))
    .where('createdAt', '>=', start)
    .where('deletedAt', 'is', null)

  const projectsInRange = await (
    deployed
      ? projectsCountQuery
          .leftJoin('worker', 'worker.projectId', 'project.id')
          .where('worker.status', '=', 'active')
      : projectsCountQuery
  ).executeTakeFirst()

  const last10Users = await db
    .selectFrom('user')
    .select(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt'])
    .where('createdAt', '>=', start)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .execute()

  const allUsers = await db
    .selectFrom('user')
    .select(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt'])
    .where('createdAt', '>=', start)
    .orderBy('createdAt', sort)
    .limit(perPage)
    .offset(offset)
    .execute()

  // Fetch projects with user info
  const projectsQuery = db
    .selectFrom('project')
    .innerJoin('user', 'user.id', 'project.userId')
    .leftJoin('worker', 'worker.projectId', 'project.id')
    .select([
      'project.id',
      'project.name',
      'project.userId',
      'project.createdAt',
      'user.name as userName',
      'user.email as userEmail',
      'worker.scriptName as workerName',
      'worker.status as workerStatus',
      'worker.hostname as workerHostname',
    ])
    .where('project.createdAt', '>=', start)
    .where('project.deletedAt', 'is', null)

  const allProjects = await (
    deployed ? projectsQuery.where('worker.status', '=', 'active') : projectsQuery
  )
    .orderBy('project.createdAt', sort)
    .limit(perPage)
    .offset(offset)
    .execute()

  const projectsWithWorker = allProjects.map((row: any) => ({
    ...row,
    worker: row.workerName
      ? { name: row.workerName, status: row.workerStatus, hostname: row.workerHostname }
      : null,
  }))

  const monthly = useMonthlyBuckets(range)
  let charts: {
    users: { date: string; count: string }[]
    projects: { date: string; count: string }[]
  }

  if (monthly) {
    const buckets = generateMonthsBetween(start, now)
    const expr = sql<string>`to_char(date_trunc('month', "createdAt"), 'YYYY-MM')`

    const usersByMonthRaw = await db
      .selectFrom('user')
      .select([expr.as('date'), sql<string>`count(*)`.as('count')])
      .where('createdAt', '>=', start)
      .groupBy(expr)
      .orderBy('date', 'asc')
      .execute()

    const projectsByMonthRaw = await db
      .selectFrom('project')
      .select([expr.as('date'), sql<string>`count(*)`.as('count')])
      .where('createdAt', '>=', start)
      .where('deletedAt', 'is', null)
      .groupBy(expr)
      .orderBy('date', 'asc')
      .execute()

    const usersMap = new Map(usersByMonthRaw.map((r) => [r.date, r.count]))
    const projectsMap = new Map(projectsByMonthRaw.map((r) => [r.date, r.count]))

    charts = {
      users: buckets.map((d) => ({ date: d, count: usersMap.get(d) || '0' })),
      projects: buckets.map((d) => ({ date: d, count: projectsMap.get(d) || '0' })),
    }
  } else {
    const buckets = generateDaysBetween(start, now)
    const expr = sql<string>`to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD')`

    const usersByDayRaw = await db
      .selectFrom('user')
      .select([expr.as('date'), sql<string>`count(*)`.as('count')])
      .where('createdAt', '>=', start)
      .groupBy(expr)
      .orderBy('date', 'asc')
      .execute()

    const projectsByDayRaw = await db
      .selectFrom('project')
      .select([expr.as('date'), sql<string>`count(*)`.as('count')])
      .where('createdAt', '>=', start)
      .where('deletedAt', 'is', null)
      .groupBy(expr)
      .orderBy('date', 'asc')
      .execute()

    const usersMap = new Map(usersByDayRaw.map((r) => [r.date, r.count]))
    const projectsMap = new Map(projectsByDayRaw.map((r) => [r.date, r.count]))

    charts = {
      users: buckets.map((d) => ({ date: d, count: usersMap.get(d) || '0' })),
      projects: buckets.map((d) => ({ date: d, count: projectsMap.get(d) || '0' })),
    }
  }

  return c.json({
    range,
    start: start.toISOString(),
    pagination: {
      page,
      perPage,
      sort,
      totalUsers: Number(usersInRange?.count ?? 0),
      totalProjects: Number(projectsInRange?.count ?? 0),
    },
    totals: {
      users: totalUsers?.count ?? '0',
      projects: totalProjects?.count ?? '0',
      usersInRange: usersInRange?.count ?? '0',
      projectsInRange: projectsInRange?.count ?? '0',
    },
    last10Users,
    allUsers,
    allProjects: projectsWithWorker,
    charts,
  })
})

admin.get('/transactions', requireAdmin, async (c) => {
  const { range, start } = getStart(c.req.query('range') || 'today')
  const now = new Date()
  const monthly = useMonthlyBuckets(range)

  const baseTx = db
    .selectFrom('pay_transaction')
    .where('env', '=', 'live')
    .where('createdAt', '>=', start)

  const dateExpr = monthly
    ? sql<string>`to_char("createdAt", 'YYYY-MM')`
    : sql<string>`to_char("createdAt", 'YYYY-MM-DD')`

  const [totals, chartRows] = await Promise.all([
    baseTx
      .select([
        sql<string>`COALESCE(SUM(CASE WHEN kind = 'payment' AND direction = 'inflow' THEN amount ELSE 0 END), 0)::text`.as(
          'grossRevenue',
        ),
        sql<string>`COALESCE(SUM(CASE WHEN kind = 'refund' THEN ABS(amount) ELSE 0 END), 0)::text`.as(
          'totalRefunds',
        ),
        sql<string>`COALESCE(SUM(CASE WHEN kind = 'processor_fee' THEN ABS(amount) ELSE 0 END), 0)::text`.as(
          'totalFees',
        ),
        sql<string>`COUNT(CASE WHEN kind = 'payment' THEN 1 END)::text`.as('transactionCount'),
        sql<string>`COUNT(*)::text`.as('totalEvents'),
      ])
      .executeTakeFirst(),

    baseTx
      .select([
        dateExpr.as('date'),
        sql<string>`COALESCE(SUM(CASE WHEN kind = 'payment' AND direction = 'inflow' THEN amount ELSE 0 END), 0)::text`.as(
          'revenue',
        ),
        sql<string>`COUNT(CASE WHEN kind = 'payment' THEN 1 END)::text`.as('transactions'),
      ])
      .groupBy(dateExpr)
      .orderBy(dateExpr)
      .execute(),
  ])

  const allDates = monthly ? generateMonthsBetween(start, now) : generateDaysBetween(start, now)
  const chartMap = new Map(chartRows.map((r) => [r.date, r]))

  const gross = Number(totals?.grossRevenue ?? 0)
  const refunds = Number(totals?.totalRefunds ?? 0)
  const fees = Number(totals?.totalFees ?? 0)

  return c.json({
    range,
    start: start.toISOString(),
    totals: {
      grossRevenue: totals?.grossRevenue ?? '0',
      netRevenue: String(gross - refunds - fees),
      totalRefunds: totals?.totalRefunds ?? '0',
      totalFees: totals?.totalFees ?? '0',
      transactionCount: totals?.transactionCount ?? '0',
      totalEvents: totals?.totalEvents ?? '0',
    },
    chart: allDates.map((date) => {
      const row = chartMap.get(date)
      return {
        date,
        revenue: row?.revenue ?? '0',
        transactions: row?.transactions ?? '0',
      }
    }),
  })
})

admin.get('/ops', requireAdmin, async (c) => {
  const { range, start } = getStart(c.req.query('range') || 'today')
  return c.json(await getAdminOpsOverview({ range, start }))
})

admin.get('/ops/jobs', requireAdmin, async (c) => {
  const queue = c.req.query('queue')?.trim()
  const state = c.req.query('state')?.trim() || 'active'
  const page = Math.max(Number(c.req.query('page')) || 1, 1)
  const perPage = Math.min(
    Math.max(Number(c.req.query('perPage') || c.req.query('limit')) || 25, 1),
    100,
  )

  if (!queue) {
    return c.json({ error: 'Queue is required' }, 400)
  }

  if (!isJobState(state)) {
    return c.json({ error: 'Invalid job state' }, 400)
  }

  const jobs = await getAdminOpsJobs({ queue, state, page, perPage })
  if (!jobs) {
    return c.json({ error: 'Queue not found' }, 404)
  }

  return c.json(jobs)
})

admin.get('/usage', requireAdmin, async (c) => {
  const { range, start } = getStart(c.req.query('range') || 'month')
  const now = new Date()
  const monthly = useMonthlyBuckets(range)

  const baseUsage = db
    .selectFrom('usage')
    .innerJoin('project', 'project.id', 'usage.projectId')
    .where('usage.deletedAt', 'is', null)
    .where('project.deletedAt', 'is', null)
    .where('usage.createdAt', '>=', start)

  const [overview, chartRows, activeChart, topUsers, modelUsage] = await Promise.all([
    baseUsage
      .select([
        sql<string>`COALESCE(SUM("usage"."billedCostMicros"), 0)::text`.as('revenue'),
        sql<string>`COALESCE(SUM("usage"."providerCostMicros"), 0)::text`.as('providerCost'),
        sql<string>`COUNT(*)::text`.as('requests'),
        sql<string>`COUNT(DISTINCT "project"."userId")::text`.as('activeUsers'),
      ])
      .executeTakeFirst(),

    baseUsage
      .select([
        sql<string>`${monthly ? sql`to_char("usage"."createdAt", 'YYYY-MM')` : sql`to_char("usage"."createdAt", 'YYYY-MM-DD')`}`.as(
          'date',
        ),
        sql<string>`COALESCE(SUM("usage"."billedCostMicros"), 0)::text`.as('revenue'),
        sql<string>`COALESCE(SUM("usage"."providerCostMicros"), 0)::text`.as('providerCost'),
        sql<string>`COUNT(*)::text`.as('requests'),
      ])
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .execute(),

    baseUsage
      .select([
        sql<string>`${monthly ? sql`to_char("usage"."createdAt", 'YYYY-MM')` : sql`to_char("usage"."createdAt", 'YYYY-MM-DD')`}`.as(
          'date',
        ),
        sql<string>`COUNT(DISTINCT "project"."userId")::text`.as('count'),
      ])
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .execute(),

    baseUsage
      .innerJoin('user', 'user.id', 'project.userId')
      .select([
        'user.id as userId',
        'user.name as userName',
        'user.email as userEmail',
        sql<string>`COUNT(*)::text`.as('requestCount'),
        sql<string>`COALESCE(SUM("usage"."billedCostMicros"), 0)::text`.as('totalSpend'),
        sql<string>`COUNT(DISTINCT "usage"."projectId")::text`.as('projectCount'),
      ])
      .groupBy(['user.id', 'user.name', 'user.email'])
      .orderBy(sql`SUM("usage"."billedCostMicros") desc`)
      .limit(25)
      .execute(),

    baseUsage
      .select([
        'usage.model',
        'usage.provider',
        sql<string>`COUNT(*)::text`.as('requests'),
        sql<string>`COALESCE(SUM("usage"."billedCostMicros"), 0)::text`.as('billedCost'),
        sql<string>`COALESCE(SUM("usage"."providerCostMicros"), 0)::text`.as('providerCost'),
        sql<string>`COALESCE(SUM("usage"."inputTokens"), 0)::text`.as('inputTokens'),
        sql<string>`COALESCE(SUM("usage"."outputTokens"), 0)::text`.as('outputTokens'),
      ])
      .groupBy(['usage.model', 'usage.provider'])
      .orderBy(sql`COUNT(*) desc`)
      .limit(20)
      .execute(),
  ])

  const topUserIds = topUsers.map((u) => u.userId)
  const userProjects =
    topUserIds.length > 0
      ? await baseUsage
          .innerJoin('user', 'user.id', 'project.userId')
          .select([
            'user.id as userId',
            'usage.projectId',
            'project.name as projectName',
            sql<string>`COUNT(*)::text`.as('requests'),
            sql<string>`COALESCE(SUM("usage"."billedCostMicros"), 0)::text`.as('spend'),
          ])
          .where('user.id', 'in', topUserIds)
          .groupBy(['user.id', 'usage.projectId', 'project.name'])
          .orderBy(sql`SUM("usage"."billedCostMicros") desc`)
          .execute()
      : []

  const userProjectMap = new Map<string, Array<(typeof userProjects)[0]>>()
  for (const row of userProjects) {
    const arr = userProjectMap.get(row.userId) ?? []
    arr.push(row)
    userProjectMap.set(row.userId, arr)
  }

  const allDates = monthly ? generateMonthsBetween(start, now) : generateDaysBetween(start, now)
  const revenueMap = new Map(chartRows.map((r) => [r.date, r]))
  const activeMap = new Map(activeChart.map((r) => [r.date, r]))

  const rev = Number(overview?.revenue ?? 0)
  const prov = Number(overview?.providerCost ?? 0)

  return c.json({
    range,
    start: start.toISOString(),
    overview: {
      totalRevenueMicros: overview?.revenue ?? '0',
      totalProviderCostMicros: overview?.providerCost ?? '0',
      marginMicros: String(rev - prov),
      marginPercent: rev > 0 ? (((rev - prov) / rev) * 100).toFixed(1) : '0',
      activeUsers: overview?.activeUsers ?? '0',
      totalRequests: overview?.requests ?? '0',
    },
    revenueChart: allDates.map((date) => {
      const row = revenueMap.get(date)
      return {
        date,
        revenue: row?.revenue ?? '0',
        providerCost: row?.providerCost ?? '0',
        requests: row?.requests ?? '0',
      }
    }),
    activeUsersChart: allDates.map((date) => ({
      date,
      count: activeMap.get(date)?.count ?? '0',
    })),
    topUsers: topUsers.map((u) => ({
      ...u,
      projects: userProjectMap.get(u.userId) ?? [],
    })),
    modelUsage,
  })
})

export default admin
