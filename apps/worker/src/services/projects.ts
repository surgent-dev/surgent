import { db } from '@/lib/db'

export function getProjectById(id: string) {
  return db.selectFrom('project').selectAll().where('id', '=', id).executeTakeFirst()
}

export async function countProjectsByOrganizationId(organizationId: string) {
  const row = await db
    .selectFrom('project')
    .select(db.fn.countAll().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return Number(row?.count ?? 0)
}

export async function createProject(args: {
  userId: string
  organizationId: string
  name: string
  githubUrl?: string
}) {
  const now = new Date()
  const row = await db
    .insertInto('project')
    .values({
      userId: args.userId,
      organizationId: args.organizationId,
      name: args.name,
      github: { url: args.githubUrl } as any,
      sandbox: { status: 'pending', isInitialized: false } as any,
      createdAt: now,
      updatedAt: now,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: row.id as string }
}

export async function updateProject(id: string, data: { metadata?: any; sandbox?: any; deployment?: any }) {
  await db
    .updateTable('project')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

export async function updateDeploymentStatus(
  id: string,
  status: string,
  name?: string,
  meta?: { step?: string; error?: string; startedAt?: Date; deployedAt?: Date },
) {
  const project = await getProjectById(id)
  if (!project) return

  const prev = (project.deployment as Record<string, any>) || {}
  await updateProject(id, {
    deployment: {
      ...prev,
      projectId: id,
      status,
      name: name ?? prev.name,
      step: meta?.step ?? prev.step,
      error: meta?.error ?? prev.error,
      startedAt: meta?.startedAt?.toISOString() ?? prev.startedAt,
      deployedAt: meta?.deployedAt?.toISOString() ?? prev.deployedAt,
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
  const row = await db.insertInto('deployment_history').values(args).returning(['id']).executeTakeFirstOrThrow()
  return { id: row.id as string }
}

export async function updateDeploymentHistory(id: string, data: { status: string; deployedAt?: Date; error?: string }) {
  await db.updateTable('deployment_history').set(data).where('id', '=', id).execute()
}
