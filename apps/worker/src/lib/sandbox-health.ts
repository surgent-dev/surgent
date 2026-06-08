export type SandboxHealthStatus = 'running' | 'paused' | 'no_sandbox' | 'not_found' | 'forbidden'

const missingSandboxPattern = /\bsandbox (?:was )?not found\b/i

export async function getSandboxHealthStatus(previewUrl: string): Promise<SandboxHealthStatus> {
  try {
    const res = await fetch(previewUrl, { method: 'GET', signal: AbortSignal.timeout(8000) })
    if (res.status === 403) return 'forbidden'
    if (res.status !== 502 && res.status !== 503) return 'running'

    const body = await res.text()
    return missingSandboxPattern.test(body) ? 'not_found' : 'paused'
  } catch {
    return 'paused'
  }
}
