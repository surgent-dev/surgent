import { afterEach, describe, expect, mock, test } from 'bun:test'

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
})
