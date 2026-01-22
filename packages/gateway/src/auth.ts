import { betterAuth } from 'better-auth'
import { apiKey } from 'better-auth/plugins'
import { createClient } from '@repo/db'
import type { Bindings } from './types'

type VerifyResult = { valid: boolean; key?: { id: string } }

let authInstance: ReturnType<typeof betterAuth> | null = null

export function getAuth(env: Bindings) {
  if (authInstance) return authInstance

  const url = env.DATABASE_URL ?? env.HYPERDRIVE?.connectionString
  if (!url) throw new Error('DATABASE_URL not set')
  if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET not set')

  const { dialect } = createClient(url, env.POSTGRES_TYPE)

  authInstance = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [
      apiKey({
        rateLimit: { enabled: false },
        enableSessionForAPIKeys: false,
        apiKeyHeaders: ['x-api-key', 'authorization'],
      }),
    ],
    database: {
      dialect,
      type: 'postgres',
    },
  })

  return authInstance
}

export async function verifyApiKey(env: Bindings, key: string): Promise<VerifyResult> {
  const auth = getAuth(env)
  const fn = (auth.api as any).verifyApiKey
  return fn({ body: { key } })
}
