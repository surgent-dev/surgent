import type { Context } from 'hono'
import { sql } from 'kysely'
import type { AppContext } from '../../../types'
import { verifyApiKey } from '../../../auth'
import { getDb } from '../../../db'
import { loadZenData } from '../util/zenData'

export function handleModelsOptions(c: Context<AppContext>) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    },
  })
}

export async function handleModelsList(c: Context<AppContext>) {
  const zenData = loadZenData(c.env)
  const key = getApiKeyFromRequest(c)
  if (key) {
    const apiKey = await validateApiKey(c, key)
    if (!apiKey) {
      return c.json({ error: 'Invalid API key.' }, 401, {
        'Access-Control-Allow-Origin': '*',
      })
    }
    const disabledModels = await getDisabledModels(c, apiKey.id)
    return c.json(
      {
        object: 'list',
        data: Object.entries(zenData.models)
          .filter(([id]) => !disabledModels.includes(id))
          .map(([id]) => ({
            id,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'surgent',
          })),
      },
      200,
      {
        'Access-Control-Allow-Origin': '*',
      },
    )
  }

  const disabledModels = await getDisabledModels(c)

  return c.json(
    {
      object: 'list',
      data: Object.entries(zenData.models)
        .filter(([id]) => !disabledModels.includes(id))
        .map(([id]) => ({
          id,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'surgent',
        })),
    },
    200,
    {
      'Access-Control-Allow-Origin': '*',
    },
  )
}

function getApiKeyFromRequest(c: Context<AppContext>) {
  const header = c.req.header('authorization')
  const authKey = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined
  return authKey ?? c.req.header('x-api-key') ?? undefined
}

async function validateApiKey(c: Context<AppContext>, key: string) {
  const verify = await verifyApiKey(c.env, key)
  if (!verify.valid || !verify.key) return null

  const db = getDb(c.env)
  const row = await db
    .selectFrom('apikey')
    .select('id')
    .where('id', '=', verify.key.id)
    .where('enabled', '=', true)
    .where('projectId', 'is not', null)
    .where((eb) => eb.or([eb('expiresAt', 'is', null), eb('expiresAt', '>', sql<Date>`now()`)]))
    .executeTakeFirst()

  return row ?? null
}

async function getDisabledModels(c: Context<AppContext>, apiKeyId?: string) {
  if (!apiKeyId) return []

  const db = getDb(c.env)
  const rows = await db
    .selectFrom('apikey')
    .innerJoin('model', (join) =>
      join.onRef('model.projectId', '=', 'apikey.projectId').on('model.deletedAt', 'is', null),
    )
    .select('model.model')
    .where('apikey.id', '=', apiKeyId)
    .execute()

  return rows.map((row) => row.model)
}
