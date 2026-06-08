import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getSandboxHealthStatus } from '../sandbox-health'

const baseFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = baseFetch
})

function mockFetch(response: Response) {
  const fetchMock = Object.assign(
    mock(async () => response),
    { preconnect: baseFetch.preconnect },
  ) satisfies typeof fetch
  globalThis.fetch = fetchMock
  return fetchMock
}

describe('getSandboxHealthStatus', () => {
  test('maps missing sandbox provider responses to not_found', async () => {
    const fetchMock = mockFetch(new Response('sandbox was not found', { status: 502 }))

    await expect(getSandboxHealthStatus('https://3000-missing.e2b.app')).resolves.toBe('not_found')
    expect(fetchMock).toHaveBeenCalledWith('https://3000-missing.e2b.app', {
      method: 'GET',
      signal: expect.any(AbortSignal),
    })
  })

  test('maps forbidden provider responses to forbidden', async () => {
    mockFetch(new Response('forbidden', { status: 403 }))

    await expect(getSandboxHealthStatus('https://3000-denied.e2b.app')).resolves.toBe('forbidden')
  })
})
