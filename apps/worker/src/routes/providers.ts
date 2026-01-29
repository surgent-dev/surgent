import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'

const providers = new Hono<AppContext>()

const idParam = z.object({ id: z.string().uuid() })
const providerParam = z.object({ id: z.string().uuid(), provider: z.string() })
const providerSchema = z.object({
  provider: z.string().min(1).max(64),
  credentials: z.string(),
})

providers.use('*', requireAuth)

async function getProjectForUser(id: string, userId: string) {
  const row = await db
    .selectFrom('project')
    .leftJoin('member', (join) =>
      join
        .onRef('member.organizationId', '=', 'project.organizationId')
        .on('member.userId', '=', userId),
    )
    .selectAll('project')
    .select('member.id as memberId')
    .where('project.id', '=', id)
    .where('project.deletedAt', 'is', null)
    .executeTakeFirst()

  if (!row) return { error: 'Project not found', status: 404 as const }
  if (!row.memberId) return { error: 'Forbidden', status: 403 as const }

  const { memberId: _, ...project } = row
  return { project }
}

// GET /providers/:id - List BYOK providers for a project
providers.get('/:id', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProjectForUser(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)

  const rows = await db
    .selectFrom('provider')
    .selectAll()
    .where('projectId', '=', id)
    .where('deletedAt', 'is', null)
    .orderBy('createdAt', 'desc')
    .execute()

  return c.json(rows)
})

// POST /providers/:id - Create/update BYOK provider credentials
providers.post(
  '/:id',
  zValidator('param', idParam),
  zValidator('json', providerSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { provider, credentials } = c.req.valid('json')
    const result = await getProjectForUser(id, c.get('user')!.id)
    if ('error' in result) return c.json({ error: result.error }, result.status)

    const now = new Date()
    await db
      .insertInto('provider')
      .values({
        id: crypto.randomUUID(),
        projectId: id,
        provider,
        credentials,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .onConflict((oc) =>
        oc.columns(['projectId', 'provider']).doUpdateSet({
          credentials,
          deletedAt: null,
          updatedAt: now,
        }),
      )
      .execute()

    return c.json({ updated: true })
  },
)

// DELETE /providers/:id/:provider - Remove BYOK provider credentials
providers.delete('/:id/:provider', zValidator('param', providerParam), async (c) => {
  const { id, provider } = c.req.valid('param')
  const result = await getProjectForUser(id, c.get('user')!.id)
  if ('error' in result) return c.json({ error: result.error }, result.status)

  await db
    .deleteFrom('provider')
    .where('projectId', '=', id)
    .where('provider', '=', provider)
    .execute()
  return c.json({ deleted: true })
})

export default providers
