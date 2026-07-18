import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'

const warn = mock(() => {})
const getActivePrimaryDomainByProjectId = mock(async () => ({ domainName: 'example.com' }))
const getWorkerByProjectId = mock(async () => ({
  hostname: 'https://app-test.surgent.site',
}))

mock.module('@/lib/config', () => ({
  config: {
    analytics: {
      url: 'http://analytics.test',
      token: 'test-token',
    },
  },
}))

mock.module('@/lib/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn, error() {} }),
}))

mock.module('@/services/projects', () => ({
  getActivePrimaryDomainByProjectId,
  getWorkerByProjectId,
}))

const originalFetch = globalThis.fetch
const { ensureAnalytics, syncProjectAnalyticsDomain, removeAnalytics } =
  await import('../analytics')

afterEach(() => {
  warn.mockClear()
  getActivePrimaryDomainByProjectId.mockClear()
  getWorkerByProjectId.mockClear()
  globalThis.fetch = originalFetch
})

describe('analytics service', () => {
  test('does not block project flows when analytics is unreachable', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const result = await ensureAnalytics({
      projectId: 'project-1',
      organizationId: 'org-1',
      userId: 'user-1',
      name: 'Ask Sis',
      domain: 'https://app-test.surgent.site',
    })

    expect(result).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  test('does not block domain updates or deletion when analytics is unreachable', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    await expect(syncProjectAnalyticsDomain('project-1')).resolves.toBeUndefined()
    await expect(removeAnalytics('project-1')).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(2)
  })

  test('keeps analytics on the stable worker hostname when a custom domain is active', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) {
        return Response.json({ data: [{ id: 'website-1', domain: 'example.com' }] })
      }
      return Response.json({})
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await syncProjectAnalyticsDomain('project-1')

    expect(getActivePrimaryDomainByProjectId).not.toHaveBeenCalled()
    expect(getWorkerByProjectId).toHaveBeenCalledWith('project-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [url, init] = fetchMock.mock.calls[1]
    expect(String(url)).toBe('http://analytics.test/api/websites/website-1')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ domain: 'app-test.surgent.site' })
  })

  test('applies a five second timeout to every analytics request', async () => {
    const timeout = spyOn(AbortSignal, 'timeout')
    let lookupCount = 0
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method) {
        lookupCount += 1
        return Response.json({
          data: lookupCount === 1 ? [] : [{ id: 'website-1', domain: 'example.com' }],
        })
      }
      return Response.json({ id: 'website-2', domain: null })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      await ensureAnalytics({
        projectId: 'project-1',
        organizationId: 'org-1',
        userId: 'user-1',
        name: 'Ask Sis',
        domain: 'https://app-test.surgent.site',
      })
      await syncProjectAnalyticsDomain('project-1')
      await removeAnalytics('project-1')

      expect(fetchMock).toHaveBeenCalledTimes(6)
      expect(timeout).toHaveBeenCalledTimes(6)
      for (let call = 1; call <= 6; call += 1) {
        expect(timeout).toHaveBeenNthCalledWith(call, 5_000)
        expect(fetchMock.mock.calls[call - 1][1]?.signal).toBeInstanceOf(AbortSignal)
      }
    } finally {
      timeout.mockRestore()
    }
  })
})
