import type { QueuePolicy, QueueResult } from 'pg-boss'
import type { ProjectMetadata } from '@repo/db'
import { db } from '@/lib/db'
import { getBoss } from '@/lib/boss'

const STUCK_PROVISIONING_MINUTES = 15
const STUCK_DEPLOYMENT_MINUTES = 20
const PG_BOSS_SCHEMA = 'pgboss'

const ACTIVE_DEPLOYMENT_STATUSES = [
  'starting',
  'deploying_convex',
  'building',
  'uploading',
] as const

const FAILED_DEPLOYMENT_STATUSES = ['build_failed', 'deploy_failed'] as const

const QUEUE_DEFS = {
  'project.create': {
    category: 'project',
    label: 'Create',
    purpose: 'Project provisioning jobs',
  },
  'project.create.dead': {
    category: 'project',
    label: 'Create DLQ',
    purpose: 'Project creation jobs that exhausted retries',
  },
  'project.deploy': {
    category: 'project',
    label: 'Deploy',
    purpose: 'Primary project deployment jobs',
  },
  'project.deploy.dead': {
    category: 'project',
    label: 'Deploy DLQ',
    purpose: 'Deployment jobs that exhausted retries',
  },
  'project.deploy.screenshot': {
    category: 'project',
    label: 'Screenshot',
    purpose: 'Post-deploy screenshot capture jobs',
  },
  'webhook.process': {
    category: 'payment',
    label: 'Webhook',
    purpose: 'Whop webhook processing jobs',
  },
  'webhook.dead': {
    category: 'payment',
    label: 'Webhook DLQ',
    purpose: 'Whop webhook jobs that exhausted retries',
  },
} as const

const QUEUE_ORDER = Object.keys(QUEUE_DEFS)

interface CountRow {
  status: string
  count: string | number | bigint
}

interface QueueStateCountsRow {
  name: string
  createdReady: number | string | null
  deferred: number | string | null
  retry: number | string | null
  active: number | string | null
  failed: number | string | null
  cancelled: number | string | null
  completed: number | string | null
  total: number | string | null
}

interface QueueStateCounts {
  createdReady: number
  deferred: number
  retry: number
  active: number
  failed: number
  cancelled: number
  completed: number
  total: number
}

interface QueueHealthItem extends QueueStateCounts {
  name: string
  category: string
  label: string
  purpose: string
  isDeadLetter: boolean
  policy: QueuePolicy | string | null
  blockedKeyCount: number
  blockedKeys: string[]
  error: string | null
}

interface QueueHealthSummary {
  dlqJobs: number
  dlqJobsInRange: number
  retryingJobs: number
  activeJobs: number
}

interface NamedCountRow {
  name: string
  count: string | number | bigint
}

interface AlertItem {
  type: 'dlq' | 'stuck_provisioning' | 'stuck_deployment' | 'queue_error'
  severity: 'critical' | 'warning'
  title: string
  message: string
  queue?: string
  count?: number
}

function toNumber(value: string | number | bigint | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') return Number(value)
  return 0
}

function getAgeMinutes(date?: Date | null): number {
  if (!date) return 0
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
}

function getProjectError(
  metadata: ProjectMetadata | null,
  failReason?: string | null,
): string | null {
  return metadata?.provisioning?.lastError || failReason || null
}

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Unknown error'
}

function getQueueDef(name: string) {
  return (
    QUEUE_DEFS[name as keyof typeof QUEUE_DEFS] || {
      category: 'other',
      label: name,
      purpose: 'Queue discovered from pg-boss',
    }
  )
}

function sanitizePgBossTable(table: string): string {
  if (!/^[a-z0-9_]+$/i.test(table)) {
    throw new Error(`Invalid pg-boss table name: ${table}`)
  }

  return table
}

function zeroCounts(): QueueStateCounts {
  return {
    createdReady: 0,
    deferred: 0,
    retry: 0,
    active: 0,
    failed: 0,
    cancelled: 0,
    completed: 0,
    total: 0,
  }
}

function groupQueueNamesByTable(queues: QueueResult[]): Map<string, string[]> {
  const namesByTable = new Map<string, string[]>()

  for (const queue of queues) {
    const names = namesByTable.get(queue.table) || []
    names.push(queue.name)
    namesByTable.set(queue.table, names)
  }

  return namesByTable
}

function getOpenQueueJobs(counts: QueueStateCounts): number {
  return counts.createdReady + counts.deferred + counts.retry + counts.active + counts.failed
}

async function getQueueStateCountsForTable(
  boss: ReturnType<typeof getBoss>,
  table: string,
  queueNames: string[],
): Promise<Map<string, QueueStateCounts>> {
  if (!queueNames.length) return new Map()

  const safeTable = sanitizePgBossTable(table)
  const text = `
    select
      name,
      count(*) filter (where state = 'created' and start_after <= now())::int as "createdReady",
      count(*) filter (where state = 'created' and start_after > now())::int as "deferred",
      count(*) filter (where state = 'retry')::int as "retry",
      count(*) filter (where state = 'active')::int as "active",
      count(*) filter (where state = 'failed')::int as "failed",
      count(*) filter (where state = 'cancelled')::int as "cancelled",
      count(*) filter (where state = 'completed')::int as "completed",
      count(*)::int as "total"
    from ${PG_BOSS_SCHEMA}.${safeTable}
    where name = any($1::text[])
    group by name
  `
  const result = await boss.getDb().executeSql(text, [queueNames])
  const map = new Map<string, QueueStateCounts>()

  for (const row of result.rows as QueueStateCountsRow[]) {
    map.set(row.name, {
      createdReady: toNumber(row.createdReady),
      deferred: toNumber(row.deferred),
      retry: toNumber(row.retry),
      active: toNumber(row.active),
      failed: toNumber(row.failed),
      cancelled: toNumber(row.cancelled),
      completed: toNumber(row.completed),
      total: toNumber(row.total),
    })
  }

  return map
}

async function getQueueStateCounts(
  boss: ReturnType<typeof getBoss>,
  queues: QueueResult[],
): Promise<Map<string, QueueStateCounts>> {
  if (!queues.length) return new Map()

  const maps = await Promise.all(
    [...groupQueueNamesByTable(queues).entries()].map(([table, names]) =>
      getQueueStateCountsForTable(boss, table, names),
    ),
  )

  const counts = new Map<string, QueueStateCounts>()
  for (const map of maps) {
    for (const [name, value] of map.entries()) {
      counts.set(name, value)
    }
  }

  return counts
}

async function getQueueCreatedSinceCountsForTable(
  boss: ReturnType<typeof getBoss>,
  table: string,
  queueNames: string[],
  start: Date,
): Promise<Map<string, number>> {
  if (!queueNames.length) return new Map()

  const safeTable = sanitizePgBossTable(table)
  const text = `
    select
      name,
      count(*)::int as "count"
    from ${PG_BOSS_SCHEMA}.${safeTable}
    where name = any($1::text[])
      and created_on >= $2
    group by name
  `
  const result = await boss.getDb().executeSql(text, [queueNames, start])
  const map = new Map<string, number>()

  for (const row of result.rows as NamedCountRow[]) {
    map.set(row.name, toNumber(row.count))
  }

  return map
}

async function getQueueCreatedSinceCounts(
  boss: ReturnType<typeof getBoss>,
  queues: QueueResult[],
  start: Date,
): Promise<Map<string, number>> {
  if (!queues.length) return new Map()

  const maps = await Promise.all(
    [...groupQueueNamesByTable(queues).entries()].map(([table, names]) =>
      getQueueCreatedSinceCountsForTable(boss, table, names, start),
    ),
  )

  const counts = new Map<string, number>()
  for (const map of maps) {
    for (const [name, value] of map.entries()) {
      counts.set(name, value)
    }
  }

  return counts
}

async function getQueueHealthSince(start: Date): Promise<{
  summary: QueueHealthSummary
  items: QueueHealthItem[]
}> {
  const boss = getBoss()
  const queues = await boss.getQueues()
  if (!queues.length) {
    return { summary: { dlqJobs: 0, dlqJobsInRange: 0, retryingJobs: 0, activeJobs: 0 }, items: [] }
  }

  const strictFifoQueues = queues.filter((queue) => queue.policy === 'key_strict_fifo')
  const deadQueues = queues.filter((queue) => queue.name.endsWith('.dead'))

  const [countsMap, createdSinceMap, blockedKeyResults] = await Promise.all([
    getQueueStateCounts(boss, queues),
    getQueueCreatedSinceCounts(boss, deadQueues, start),
    Promise.allSettled(strictFifoQueues.map((queue) => boss.getBlockedKeys(queue.name))),
  ])

  const blockedKeysByName = new Map<string, { blockedKeys: string[]; error: string | null }>()
  strictFifoQueues.forEach((queue, index) => {
    const result = blockedKeyResults[index]
    blockedKeysByName.set(queue.name, {
      blockedKeys: result?.status === 'fulfilled' ? result.value : [],
      error: result?.status === 'rejected' ? getMessage(result.reason) : null,
    })
  })

  const items = queues
    .map((queue) => {
      const def = getQueueDef(queue.name)
      const blocked = blockedKeysByName.get(queue.name)

      return {
        name: queue.name,
        category: def.category,
        label: def.label,
        purpose: def.purpose,
        isDeadLetter: queue.name.endsWith('.dead'),
        policy: queue.policy ?? null,
        blockedKeyCount: blocked?.blockedKeys.length || 0,
        blockedKeys: blocked?.blockedKeys || [],
        error: blocked?.error || null,
        ...(countsMap.get(queue.name) || zeroCounts()),
      } satisfies QueueHealthItem
    })
    .sort((a, b) => {
      const aIndex = QUEUE_ORDER.indexOf(a.name)
      const bIndex = QUEUE_ORDER.indexOf(b.name)
      if (aIndex !== -1 || bIndex !== -1) {
        return (
          (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
          (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
        )
      }
      return a.name.localeCompare(b.name)
    })

  return {
    summary: {
      dlqJobs: items.reduce(
        (sum, item) => sum + (item.isDeadLetter ? getOpenQueueJobs(item) : 0),
        0,
      ),
      dlqJobsInRange: deadQueues.reduce(
        (sum, queue) => sum + (createdSinceMap.get(queue.name) || 0),
        0,
      ),
      retryingJobs: items.reduce((sum, item) => sum + item.retry, 0),
      activeJobs: items.reduce((sum, item) => sum + item.active, 0),
    },
    items,
  }
}

export async function getAdminOpsOverview(params: { range: string; start: Date }) {
  const now = new Date()
  const stuckProvisioningCutoff = new Date(now.getTime() - STUCK_PROVISIONING_MINUTES * 60_000)
  const stuckDeploymentCutoff = new Date(now.getTime() - STUCK_DEPLOYMENT_MINUTES * 60_000)

  const [
    projectCounts,
    projectFailuresInRange,
    stuckProjects,
    recentProjectFailures,
    deploymentCounts,
    deploymentFailuresInRange,
    activeDeployments,
    recentDeploymentFailures,
    stuckDeploymentCount,
    queues,
  ] = await Promise.all([
    db
      .selectFrom('project')
      .select(['status', db.fn.countAll().as('count')])
      .where('deletedAt', 'is', null)
      .groupBy('status')
      .execute() as Promise<CountRow[]>,
    db
      .selectFrom('project')
      .select(db.fn.countAll().as('count'))
      .where('deletedAt', 'is', null)
      .where('status', '=', 'failed')
      .where('updatedAt', '>=', params.start)
      .executeTakeFirst(),
    db
      .selectFrom('project')
      .innerJoin('user', 'user.id', 'project.userId')
      .select([
        'project.id',
        'project.name',
        'project.createdAt',
        'project.updatedAt',
        'project.metadata',
        'project.failReason',
        'user.email as userEmail',
      ])
      .where('project.deletedAt', 'is', null)
      .where('project.status', '=', 'provisioning')
      .where('project.updatedAt', '<', stuckProvisioningCutoff)
      .orderBy('project.updatedAt', 'asc')
      .limit(25)
      .execute(),
    db
      .selectFrom('project')
      .innerJoin('user', 'user.id', 'project.userId')
      .select([
        'project.id',
        'project.name',
        'project.createdAt',
        'project.updatedAt',
        'project.metadata',
        'project.failReason',
        'user.email as userEmail',
      ])
      .where('project.deletedAt', 'is', null)
      .where('project.status', '=', 'failed')
      .where('project.updatedAt', '>=', params.start)
      .orderBy('project.updatedAt', 'desc')
      .limit(25)
      .execute(),
    db
      .selectFrom('deployment')
      .innerJoin('project', 'project.id', 'deployment.projectId')
      .select(['deployment.status', db.fn.countAll().as('count')])
      .where('project.deletedAt', 'is', null)
      .groupBy('deployment.status')
      .execute() as Promise<CountRow[]>,
    db
      .selectFrom('deployment')
      .innerJoin('project', 'project.id', 'deployment.projectId')
      .select(db.fn.countAll().as('count'))
      .where('project.deletedAt', 'is', null)
      .where('deployment.status', 'in', FAILED_DEPLOYMENT_STATUSES)
      .where('deployment.finishedAt', '>=', params.start)
      .executeTakeFirst(),
    db
      .selectFrom('deployment')
      .innerJoin('project', 'project.id', 'deployment.projectId')
      .innerJoin('user', 'user.id', 'project.userId')
      .select([
        'deployment.id',
        'deployment.status',
        'deployment.startedAt',
        'deployment.finishedAt',
        'deployment.error',
        'deployment.scriptName',
        'deployment.hostname',
        'project.id as projectId',
        'project.name as projectName',
        'user.email as userEmail',
      ])
      .where('project.deletedAt', 'is', null)
      .where('deployment.status', 'in', ACTIVE_DEPLOYMENT_STATUSES)
      .orderBy('deployment.startedAt', 'asc')
      .limit(25)
      .execute(),
    db
      .selectFrom('deployment')
      .innerJoin('project', 'project.id', 'deployment.projectId')
      .innerJoin('user', 'user.id', 'project.userId')
      .select([
        'deployment.id',
        'deployment.status',
        'deployment.startedAt',
        'deployment.finishedAt',
        'deployment.error',
        'deployment.scriptName',
        'deployment.hostname',
        'project.id as projectId',
        'project.name as projectName',
        'user.email as userEmail',
      ])
      .where('project.deletedAt', 'is', null)
      .where('deployment.status', 'in', FAILED_DEPLOYMENT_STATUSES)
      .where('deployment.finishedAt', '>=', params.start)
      .orderBy('deployment.finishedAt', 'desc')
      .limit(25)
      .execute(),
    db
      .selectFrom('deployment')
      .innerJoin('project', 'project.id', 'deployment.projectId')
      .select(db.fn.countAll().as('count'))
      .where('project.deletedAt', 'is', null)
      .where('deployment.status', 'in', ACTIVE_DEPLOYMENT_STATUSES)
      .where('deployment.startedAt', '<', stuckDeploymentCutoff)
      .executeTakeFirst(),
    getQueueHealthSince(params.start),
  ])

  const projectCountsByStatus = new Map(
    projectCounts.map((row) => [row.status, toNumber(row.count)]),
  )
  const deploymentCountsByStatus = new Map(
    deploymentCounts.map((row) => [row.status, toNumber(row.count)]),
  )

  const alerts: AlertItem[] = []

  if (queues.summary.dlqJobs > 0) {
    alerts.push({
      type: 'dlq',
      severity: 'critical',
      title: 'Dead-letter jobs waiting',
      message: `${queues.summary.dlqJobs} jobs still need attention in dead-letter queues`,
      count: queues.summary.dlqJobs,
    })
  }

  if (stuckProjects.length > 0) {
    alerts.push({
      type: 'stuck_provisioning',
      severity: 'warning',
      title: 'Projects stuck provisioning',
      message: `${stuckProjects.length} projects have been provisioning for over ${STUCK_PROVISIONING_MINUTES} minutes`,
      count: stuckProjects.length,
    })
  }

  const stuckActive = toNumber(stuckDeploymentCount?.count)
  if (stuckActive > 0) {
    alerts.push({
      type: 'stuck_deployment',
      severity: 'warning',
      title: 'Deployments running too long',
      message: `${stuckActive} deployments have been active for over ${STUCK_DEPLOYMENT_MINUTES} minutes`,
      count: stuckActive,
    })
  }

  const queueErrors = queues.items.filter((item) => item.error)
  if (queueErrors.length > 0) {
    alerts.push({
      type: 'queue_error',
      severity: 'warning',
      title: 'Queue inspection is partial',
      message: `${queueErrors.length} queues could not be inspected completely`,
      count: queueErrors.length,
    })
  }

  return {
    generatedAt: now.toISOString(),
    range: params.range,
    start: params.start.toISOString(),
    thresholds: {
      stuckProvisioningMinutes: STUCK_PROVISIONING_MINUTES,
      stuckDeploymentMinutes: STUCK_DEPLOYMENT_MINUTES,
    },
    alerts,
    problems: {
      summary: {
        projectFailures: toNumber(projectFailuresInRange?.count),
        deploymentFailures: toNumber(deploymentFailuresInRange?.count),
        dlqJobs: queues.summary.dlqJobsInRange,
      },
    },
    projects: {
      summary: {
        provisioning: projectCountsByStatus.get('provisioning') || 0,
        ready: projectCountsByStatus.get('ready') || 0,
        failed: projectCountsByStatus.get('failed') || 0,
        stuckProvisioning: stuckProjects.length,
      },
      stuck: stuckProjects.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt?.toISOString() ?? now.toISOString(),
        updatedAt:
          row.updatedAt?.toISOString() ?? row.createdAt?.toISOString() ?? now.toISOString(),
        userEmail: row.userEmail,
        provisioningStep: row.metadata?.provisioningStep ?? null,
        error: getProjectError(row.metadata, row.failReason),
        ageMinutes: getAgeMinutes(row.updatedAt ?? row.createdAt),
      })),
      recentFailures: recentProjectFailures.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt?.toISOString() ?? now.toISOString(),
        updatedAt:
          row.updatedAt?.toISOString() ?? row.createdAt?.toISOString() ?? now.toISOString(),
        userEmail: row.userEmail,
        provisioningStep: row.metadata?.provisioningStep ?? null,
        error: getProjectError(row.metadata, row.failReason),
        ageMinutes: getAgeMinutes(row.updatedAt ?? row.createdAt),
      })),
    },
    deployments: {
      summary: {
        queued: deploymentCountsByStatus.get('queued') || 0,
        active: ACTIVE_DEPLOYMENT_STATUSES.reduce(
          (sum, status) => sum + (deploymentCountsByStatus.get(status) || 0),
          0,
        ),
        deployed: deploymentCountsByStatus.get('deployed') || 0,
        buildFailed: deploymentCountsByStatus.get('build_failed') || 0,
        deployFailed: deploymentCountsByStatus.get('deploy_failed') || 0,
        cancelled: deploymentCountsByStatus.get('cancelled') || 0,
        stuckActive,
      },
      active: activeDeployments.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        projectName: row.projectName,
        userEmail: row.userEmail,
        status: row.status,
        startedAt: row.startedAt?.toISOString() ?? now.toISOString(),
        hostname: row.hostname,
        scriptName: row.scriptName,
        ageMinutes: getAgeMinutes(row.startedAt),
        isStuck: row.startedAt ? row.startedAt < stuckDeploymentCutoff : false,
      })),
      recentFailures: recentDeploymentFailures.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        projectName: row.projectName,
        userEmail: row.userEmail,
        status: row.status,
        startedAt: row.startedAt?.toISOString() ?? null,
        finishedAt: row.finishedAt?.toISOString() ?? now.toISOString(),
        hostname: row.hostname,
        scriptName: row.scriptName,
        error: row.error,
      })),
    },
    queues,
  }
}
