import { Hono } from 'hono'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { isAdmin } from '../middleware/admin'

const providers = new Hono<AppContext>()

const idParam = z.object({ id: z.string().uuid() })
const providerParam = z.object({ id: z.string().uuid(), provider: z.string() })
const providerSchema = z.object({
  provider: z.string().min(1).max(64),
  credentials: z.string(),
})

providers.use('*', requireAuth)

type User = { id: string; role?: string | null }

async function getProjectForUser(id: string, user: User) {
  const project = await db
    .selectFrom('project')
    .selectAll()
    .where('id', '=', id)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()

  if (!project) return { error: 'Project not found', status: 404 as const }

  if (!isAdmin(user)) {
    const member = await db
      .selectFrom('member')
      .select('id')
      .where('organizationId', '=', project.organizationId)
      .where('userId', '=', user.id)
      .executeTakeFirst()
    if (!member) return { error: 'Forbidden', status: 403 as const }
  }

  return { project }
}

// GET /providers/:id - List BYOK providers for a project
providers.get('/:id', zValidator('param', idParam), async (c) => {
  const { id } = c.req.valid('param')
  const result = await getProjectForUser(id, c.get('user')!)
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
    const result = await getProjectForUser(id, c.get('user')!)
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
  const result = await getProjectForUser(id, c.get('user')!)
  if ('error' in result) return c.json({ error: result.error }, result.status)

  await db
    .deleteFrom('provider')
    .where('projectId', '=', id)
    .where('provider', '=', provider)
    .execute()
  return c.json({ deleted: true })
})

export default providers
