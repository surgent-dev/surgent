import type { PayEnv } from './types'
import { hashApiKey } from './utils'
import { db } from '@/lib/db'

const KEY_LENGTH = 40

function randomChars(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export async function generatePayApiKey(env: PayEnv): Promise<{
  key: string
  hashed: string
  prefix: string
  start: string
}> {
  const prefix = env === 'test' ? 'sk_test_' : 'sk_live_'
  const raw = randomChars(KEY_LENGTH)
  const key = `${prefix}${raw}`
  const hashed = await hashApiKey(key)
  const start = key.slice(0, 12)
  return { key, hashed, prefix, start }
}

export async function createProjectPayApiKey(args: {
  name: string
  env: PayEnv
  userId: string
  organizationId: string
  projectId: string
}) {
  const generated = await generatePayApiKey(args.env)
  const now = new Date()
  const row = await db
    .insertInto('apikey')
    .values({
      name: args.name,
      prefix: generated.prefix,
      start: generated.start,
      key: generated.hashed,
      userId: args.userId,
      organizationId: args.organizationId,
      projectId: args.projectId,
      enabled: true,
      metadata: null,
      env: args.env,
      createdAt: now,
      updatedAt: now,
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  return { id: row.id, key: generated.key }
}

export type AuthorizedPayApiKey = {
  userId: string
  projectId: string | null
  env: PayEnv
}

export function readApiKey(headers: Headers): string | null {
  return (
    headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
  )
}

export async function authorizePayApiKey(headers: Headers): Promise<AuthorizedPayApiKey | null> {
  const apiKey = readApiKey(headers)
  if (!apiKey) return null

  const hashed = await hashApiKey(apiKey)
  const row = await db
    .selectFrom('apikey')
    .select(['projectId', 'userId', 'expiresAt', 'env'])
    .where('key', '=', hashed)
    .where('enabled', '=', true)
    .executeTakeFirst()

  if (!row) return null
  if (row.expiresAt && row.expiresAt <= new Date()) return null
  if (row.env !== 'test' && row.env !== 'live') return null

  return { userId: row.userId, projectId: row.projectId, env: row.env }
}
