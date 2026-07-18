import prisma from '@/lib/prisma'
import { createSession } from './createSession'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    rawQuery: jest.fn(),
  },
}))

const mockRawQuery = jest.mocked(prisma.rawQuery)

test('keeps repeated session creation idempotent', async () => {
  const session = {
    id: '92c78cc7-5af9-517f-9713-2a005e014f0b',
    websiteId: '424728af-4fbf-430d-a53c-152f659a4bd6',
    createdAt: new Date('2026-07-16T21:19:41.500Z'),
  }

  await createSession(session)
  await createSession(session)

  expect(mockRawQuery).toHaveBeenCalledTimes(2)
  for (const [query, params, functionName] of mockRawQuery.mock.calls) {
    expect(query).toContain('on conflict (session_id) do nothing')
    expect(params).toBe(session)
    expect(functionName).toBe('createSession')
  }
})
