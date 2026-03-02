import { config } from '../config'

export async function generateEntriToken(userId: string): Promise<string> {
  const secret = config.entri.secret
  if (!secret) throw new Error('ENTRI_SECRET not configured')

  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    applicationId: config.entri.applicationId,
    userId,
    iat: now,
    exp: now + 3600, // 1 hour
  }

  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')

  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = Buffer.from(sig).toString('base64url')

  return `${data}.${sigB64}`
}
