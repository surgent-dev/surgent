import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppContext } from '@/types/application'
import { db } from '@/lib/db'
import { isAdmin } from '@/middleware/admin'
import { rateLimit } from '@/middleware/rate-limit'
import { hashApiKey } from '@/lib/pay/utils'
import {
  MaxOps,
  Bootstrap,
  Delete,
  Pull,
  Write,
  type Scope,
  bootstrap,
  del,
  pull,
  write,
} from '@/lib/opencode-sync'

const sync = new Hono<AppContext>()

async function scope(c: Context<AppContext>): Promise<Scope> {
  const raw = c.req.header('x-api-key') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
  if (raw) {
    const hashed = await hashApiKey(raw)
    const key = await db
      .selectFrom('apikey')
      .select(['userId', 'organizationId', 'projectId', 'enabled', 'expiresAt'])
      .where('key', '=', hashed)
      .executeTakeFirst()

    if (!key?.enabled) throw new Error('unauthorized')
    if (key.expiresAt && key.expiresAt <= new Date()) throw new Error('unauthorized')
    if (!key.organizationId || !key.projectId) throw new Error('unauthorized')

    const requested = c.req.header('x-org-id')
    if (requested && requested !== key.organizationId) throw new Error('forbidden')

    return { userId: key.userId, organizationId: key.organizationId, projectId: key.projectId }
  }

  const user = c.get('user')
  const session = c.get('session')
  if (!user || !session) throw new Error('unauthorized')

  const projectId = c.req.header('x-project-id')
  if (!projectId) throw new Error('unauthorized')

  const project = await db
    .selectFrom('project')
    .select(['id', 'organizationId'])
    .where('id', '=', projectId)
    .executeTakeFirst()
  if (!project) throw new Error('forbidden')

  const requested = c.req.header('x-org-id')
  if (requested && requested !== project.organizationId) throw new Error('forbidden')

  if (project.organizationId !== session.activeOrganizationId && !isAdmin(user)) {
    const member = await db
      .selectFrom('member')
      .select('id')
      .where('organizationId', '=', project.organizationId)
      .where('userId', '=', user.id)
      .executeTakeFirst()
    if (!member) throw new Error('forbidden')
  }

  return { userId: user.id, organizationId: project.organizationId, projectId }
}

async function handle<T>(c: Context<AppContext>, fn: (s: Scope) => Promise<T>) {
  try {
    return c.json(await fn(await scope(c)))
  } catch (e: any) {
    if (e?.message === 'unauthorized') return c.json({ error: 'Unauthorized' }, 401)
    if (e?.message === 'forbidden') return c.json({ error: 'Forbidden' }, 403)
    throw e
  }
}

sync.post('/bootstrap', rateLimit(20, 60_000), zValidator('json', Bootstrap), (c) =>
  handle(c, (s) => bootstrap(s, c.req.valid('json'))),
)

sync.get('/pull', rateLimit(120, 60_000), zValidator('query', Pull), (c) =>
  handle(c, (s) => pull(s, c.req.valid('query'))),
)

sync.post(
  '/write',
  rateLimit(240, 60_000),
  zValidator('json', z.object({ ops: Write.array().min(1).max(MaxOps) })),
  (c) => handle(c, (s) => write(s, c.req.valid('json').ops).then((ops) => ({ ops }))),
)

sync.post(
  '/delete',
  rateLimit(240, 60_000),
  zValidator('json', z.object({ ops: Delete.array().min(1).max(MaxOps) })),
  (c) => handle(c, (s) => del(s, c.req.valid('json').ops).then((ops) => ({ ops }))),
)

export default sync
