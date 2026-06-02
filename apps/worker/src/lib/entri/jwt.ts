import { config } from '../config'
import { createLogger } from '../logger'

const log = createLogger('entri')

/**
 * Fetch a JWT from the Entri API.
 * Docs: https://developers.entri.com/docs/install
 */
export async function generateEntriToken(_userId: string): Promise<string> {
  const applicationId = config.entri.applicationId
  const secret = config.entri.secret

  if (!applicationId || !secret) {
    throw new Error('ENTRI_APP_ID and ENTRI_SECRET must be configured')
  }

  const res = await fetch('https://api.goentri.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId, secret }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    log.error({ status: res.status, hasBody: Boolean(text) }, 'failed to fetch Entri token')
    throw new Error(`Failed to fetch Entri token: ${res.status}`)
  }

  const data = (await res.json()) as { auth_token: string }

  log.info({ applicationId, hasToken: !!data.auth_token }, 'Entri token response')

  if (!data.auth_token) {
    log.error('Entri API did not return an auth_token')
    throw new Error('Entri API did not return an auth_token')
  }

  return data.auth_token
}
