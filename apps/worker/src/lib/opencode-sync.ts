import { db } from '@/lib/db'
import type { Database } from '@repo/db'
import { sql, type Transaction } from 'kysely'
import { z } from 'zod'

export const MaxOps = 100
const MaxBytes = 512 * 1024

function checkSize(v: unknown, ctx: z.RefinementCtx) {
  if (JSON.stringify(v ?? null).length > MaxBytes)
    ctx.addIssue({ code: 'custom', message: `payload exceeds ${MaxBytes} bytes` })
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const Entity = z.enum([
  'project',
  'workspace',
  'session',
  'message',
  'part',
  'todo',
  'session_diff',
])

export const Write = z.object({
  entity: Entity,
  id: z.string(),
  session_id: z.string().nullable().optional(),
  message_id: z.string().nullable().optional(),
  payload: z.unknown().superRefine(checkSize),
})

export const Delete = z.object({
  entity: Entity,
  id: z.string(),
})

export const Bootstrap = z.object({
  ops: Write.array().max(5000).optional(),
})

export const Pull = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

export type Scope = { userId: string; organizationId: string; projectId: string }

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Op = z.infer<typeof Write> | z.infer<typeof Delete>
type Trx = Transaction<Database>
type Conn = typeof db | Trx

const rank = (entity: string) =>
  sql<number>`case ${sql.ref(entity)}
    when 'project' then 0
    when 'workspace' then 1
    when 'session' then 2
    when 'message' then 3
    when 'part' then 4
    when 'todo' then 5
    when 'session_diff' then 6
    else 99
  end`

function sessionId(op: z.infer<typeof Write>) {
  if (op.entity === 'project' || op.entity === 'workspace') return null
  if (op.entity === 'todo' || op.entity === 'session_diff') return op.id
  if (op.entity === 'session') return op.id
  return op.session_id ?? null
}

async function upsert(trx: Trx, scope: Scope, op: z.infer<typeof Write>) {
  const now = Date.now()
  await trx
    .insertInto('opencode_sync_entity')
    .values({
      projectId: scope.projectId,
      userId: scope.userId,
      organizationId: scope.organizationId,
      entity: op.entity,
      id: op.id,
      sessionId: sessionId(op),
      messageId: op.message_id ?? null,
      payload: op.payload,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['projectId', 'entity', 'id']).doUpdateSet({
        userId: scope.userId,
        organizationId: scope.organizationId,
        sessionId: sessionId(op),
        messageId: op.message_id ?? null,
        payload: op.payload,
        updatedAt: now,
      }),
    )
    .execute()
}

async function remove(trx: Trx, scope: Scope, op: z.infer<typeof Delete>) {
  const base = trx.deleteFrom('opencode_sync_entity').where('projectId', '=', scope.projectId)

  if (op.entity === 'session') {
    await base
      .where((eb) =>
        eb.or([
          eb.and([eb('entity', '=', 'session'), eb('id', '=', op.id)]),
          eb('sessionId', '=', op.id),
        ]),
      )
      .execute()
    return
  }

  if (op.entity === 'message') {
    await base
      .where((eb) =>
        eb.or([
          eb.and([eb('entity', '=', 'message'), eb('id', '=', op.id)]),
          eb('messageId', '=', op.id),
        ]),
      )
      .execute()
    return
  }

  await base.where('entity', '=', op.entity).where('id', '=', op.id).execute()
}

async function log(trx: Trx, scope: Scope, op: Op, kind: 'write' | 'delete') {
  const row = await trx
    .insertInto('opencode_sync_op')
    .values({
      projectId: scope.projectId,
      userId: scope.userId,
      organizationId: scope.organizationId,
      entity: op.entity,
      op: kind,
      entityId: op.id,
      payload: 'payload' in op ? op.payload : null,
      createdAt: Date.now(),
    })
    .returning(['seq', 'entity', 'op', 'entityId', 'payload', 'createdAt'])
    .executeTakeFirstOrThrow()

  return {
    seq: Number(row.seq),
    entity: row.entity,
    op: row.op as 'write' | 'delete',
    id: row.entityId,
    payload: row.payload,
    created_at: Number(row.createdAt),
  }
}

async function max(conn: Conn, scope: Scope) {
  const row = await conn
    .selectFrom('opencode_sync_op')
    .select(sql<string>`coalesce(max(seq), 0)`.as('seq'))
    .where('projectId', '=', scope.projectId)
    .executeTakeFirst()
  return Number(row?.seq ?? 0)
}

async function load(conn: Conn, scope: Scope) {
  const rows = await conn
    .selectFrom('opencode_sync_entity')
    .select(['entity', 'id', 'sessionId', 'messageId', 'payload'])
    .where('projectId', '=', scope.projectId)
    .orderBy(rank('entity'), 'asc')
    .orderBy('updatedAt', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return rows.map((row) => ({
    entity: row.entity,
    id: row.id,
    session_id: row.sessionId,
    message_id: row.messageId,
    payload: row.payload,
  }))
}

async function writes(trx: Trx, scope: Scope, ops: z.infer<typeof Write>[]) {
  const result = []
  for (const op of ops) {
    await upsert(trx, scope, op)
    result.push(await log(trx, scope, op, 'write'))
  }
  return result
}

async function dels(trx: Trx, scope: Scope, ops: z.infer<typeof Delete>[]) {
  const result = []
  for (const op of ops) {
    await remove(trx, scope, op)
    result.push(await log(trx, scope, op, 'delete'))
  }
  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function lock(trx: Trx, scope: Scope) {
  return sql`select pg_advisory_xact_lock(hashtext(${`opencode-sync:${scope.projectId}`}))`.execute(
    trx,
  )
}

export async function write(scope: Scope, ops: z.infer<typeof Write>[]) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, scope)
    return writes(trx, scope, ops)
  })
}

export async function del(scope: Scope, ops: z.infer<typeof Delete>[]) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, scope)
    return dels(trx, scope, ops)
  })
}

export async function pull(scope: Scope, input: z.infer<typeof Pull>) {
  const rows = await db
    .selectFrom('opencode_sync_op')
    .select(['seq', 'entity', 'op', 'entityId', 'payload', 'createdAt'])
    .where('projectId', '=', scope.projectId)
    .where('seq', '>', input.after)
    .orderBy('seq', 'asc')
    .limit(input.limit)
    .execute()

  const ops = rows.map((row) => ({
    seq: Number(row.seq),
    entity: row.entity,
    op: row.op as 'write' | 'delete',
    id: row.entityId,
    payload: row.payload,
    created_at: Number(row.createdAt),
  }))

  return {
    ops,
    cursor: ops.at(-1)?.seq ?? input.after,
    has_more: ops.length >= input.limit,
  }
}

export async function bootstrap(scope: Scope, input: z.infer<typeof Bootstrap>) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, scope)

    const seq = await max(trx, scope)

    if (seq === 0 && input.ops?.length) {
      const ops = await writes(trx, scope, input.ops)
      return { action: 'seeded' as const, seq: ops.at(-1)?.seq ?? 0 }
    }

    if (seq === 0) {
      return { action: 'empty' as const, seq: 0 }
    }

    return { action: 'hydrate' as const, seq, ops: await load(trx, scope) }
  })
}
