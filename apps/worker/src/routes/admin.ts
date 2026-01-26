import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import { requireAdmin } from '@/middleware/admin'

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
      ? projectsCountQuery.leftJoin('worker', 'worker.projectId', 'project.id').where('worker.status', '=', 'active')
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

  const allProjects = await (deployed ? projectsQuery.where('worker.status', '=', 'active') : projectsQuery)
    .orderBy('project.createdAt', sort)
    .limit(perPage)
    .offset(offset)
    .execute()

  const projectsWithWorker = allProjects.map((row: any) => ({
    ...row,
    worker: row.workerName ? { name: row.workerName, status: row.workerStatus, hostname: row.workerHostname } : null,
  }))

  const monthly = useMonthlyBuckets(range)
  let charts: { users: { date: string; count: string }[]; projects: { date: string; count: string }[] }

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

export default admin
