import type { Bindings } from './types'
import { getDb } from './db'

type VerifyResult = { valid: boolean; key?: { id: string } }

function base64UrlEncode(bytes: Uint8Array) {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hashApiKey(key: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return base64UrlEncode(new Uint8Array(digest))
}

export async function verifyApiKey(env: Bindings, key: string): Promise<VerifyResult> {
  const db = getDb(env)
  const hashed = await hashApiKey(key)
  console.log(`AUTH DEBUG: hashed key=${hashed}`)
  const row = await db.selectFrom('apikey').select('id').where('key', '=', hashed).executeTakeFirst()
  console.log(`AUTH DEBUG: row found=${!!row}`)
  if (!row) return { valid: false }
  return { valid: true, key: { id: row.id } }
}
