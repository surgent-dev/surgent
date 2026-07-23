import { afterEach, describe, expect, mock, test } from 'bun:test'

mock.module('@/lib/config', () => ({
  config: {
    convex: {
      host: 'https://api.convex.test',
      teamId: 'team-id',
      teamToken: 'team-token',
    },
  },
}))

const originalFetch = globalThis.fetch
const { deleteProject } = await import('../convex')

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('deleteProject', () => {
  test('uses the Convex management API delete contract', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await deleteProject('project/id')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.convex.test/v1/projects/project%2Fid/delete',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
        headers: expect.objectContaining({
          Authorization: 'Bearer team-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  test('treats an already-deleted project as success', async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch

    await expect(deleteProject('missing-project')).resolves.toBeUndefined()
  })

  test('propagates other provider failures', async () => {
    globalThis.fetch = mock(
      async () => new Response('permission denied', { status: 403 }),
    ) as unknown as typeof fetch

    await expect(deleteProject('forbidden-project')).rejects.toThrow('permission denied')
  })
})
