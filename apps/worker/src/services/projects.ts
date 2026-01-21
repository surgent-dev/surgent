import { db } from '@/lib/db'
import { SurpayService } from '@/services/surpay'

export function getProjectById(projectId: string) {
  return db.selectFrom('project').selectAll().where('id', '=', projectId).executeTakeFirst()
}

export async function countProjectsByUserId(userId: string): Promise<number> {
  const result = await db
    .selectFrom('project')
    .select(db.fn.countAll().as('count'))
    .where('userId', '=', userId)
    .executeTakeFirst()

  return Number(result?.count ?? 0)
}

export async function createProject(args: {
  userId: string
  name: string
  githubUrl?: string
}): Promise<{ id: string }> {
  const now = new Date()

  const row = await db
    .insertInto('project')
    .values({
      userId: args.userId,
      name: args.name,
      github: { url: args.githubUrl } as any,
      settings: null,
      metadata: null,
      deployment: null,
      sandbox: { status: 'pending', isInitialized: false } as any,
      createdAt: now,
      updatedAt: now,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  try {
    await SurpayService.createProject(args.userId, row.id as string, args.name)
  } catch (e) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.error('FAILED TO CREATE SURPAY PROJECT', e)
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  }

  return { id: row.id as string }
}

export async function updateProject(projectId: string, data: { metadata?: any; sandbox?: any; deployment?: any }) {
  await db
    .updateTable('project')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', projectId)
    .execute()
}

export async function updateDeploymentStatus(
  projectId: string,
  status: string,
  name?: string,
  meta?: { step?: string; error?: string; startedAt?: Date; deployedAt?: Date },
) {
  const project = await getProjectById(projectId)
  if (!project) return

  const currentDeployment = project.deployment || {}

  await updateProject(projectId, {
    deployment: {
      ...currentDeployment,
      projectId: projectId,
      status,
      ...(name ? { name } : {}),
      ...(meta?.step ? { step: meta.step } : {}),
      ...(meta?.error ? { error: meta.error } : {}),
      ...(meta?.startedAt ? { startedAt: meta.startedAt.toISOString() } : {}),
      ...(meta?.deployedAt ? { deployedAt: meta.deployedAt.toISOString() } : {}),
      ...(currentDeployment.startedAt && !meta?.startedAt ? { startedAt: currentDeployment.startedAt } : {}),
      updatedAt: new Date(),
    },
  })
}

export async function createDeploymentHistory(args: {
  projectId: string
  name: string
  previewUrl: string
  status: string
  startedAt: Date
}) {
  const row = await db
    .insertInto('deployment_history')
    .values({
      projectId: args.projectId,
      name: args.name,
      previewUrl: args.previewUrl,
      status: args.status,
      startedAt: args.startedAt,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  return { id: row.id as string }
}

export async function updateDeploymentHistory(
  deploymentHistoryId: string,
  data: { status: string; deployedAt?: Date; error?: string },
) {
  await db
    .updateTable('deployment_history')
    .set({
      status: data.status,
      ...(data.deployedAt ? { deployedAt: data.deployedAt } : {}),
      ...(data.error ? { error: data.error } : {}),
    })
    .where('id', '=', deploymentHistoryId)
    .execute()
}
