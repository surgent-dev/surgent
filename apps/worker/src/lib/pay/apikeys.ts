import type { PayEnv } from './types'
import { hashApiKey } from './utils'

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
