import { uuid } from '@/lib/crypto'
import { isClickhouseEnabled } from '@/lib/db'
import { getClientInfo, hasBlockedIp } from '@/lib/detect'
import { createToken, parseToken } from '@/lib/jwt'
import { fetchWebsite, fetchWebsiteByHostname } from '@/lib/load'
import { createSession, saveEvent, saveSessionData } from '@/queries/sql'
import { POST } from './route'

jest.mock('@/lib/crypto', () => ({
  hash: jest.fn((value) => `hash:${value}`),
  secret: jest.fn(() => 'test-secret'),
  uuid: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  isClickhouseEnabled: jest.fn(),
}))

jest.mock('@/lib/detect', () => ({
  getClientInfo: jest.fn(),
  hasBlockedIp: jest.fn(),
}))

jest.mock('@/lib/jwt', () => ({
  createToken: jest.fn(),
  parseToken: jest.fn(),
}))

jest.mock('@/lib/load', () => ({
  fetchWebsite: jest.fn(),
  fetchWebsiteByHostname: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequest: jest.fn(async (request: Request) => ({ body: await request.json() })),
}))

jest.mock('@/queries/sql', () => ({
  createSession: jest.fn(),
  saveEvent: jest.fn(),
  saveSessionData: jest.fn(),
}))

const WEBSITE_ID = '424728af-4fbf-430d-a53c-152f659a4bd6'
const SESSION_ID = '92c78cc7-5af9-517f-9713-2a005e014f0b'
const VISIT_ID = '90721a5e-faee-5c85-8446-c59ef1f7b19f'

const mockUuid = jest.mocked(uuid)
const mockIsClickhouseEnabled = jest.mocked(isClickhouseEnabled)
const mockGetClientInfo = jest.mocked(getClientInfo)
const mockHasBlockedIp = jest.mocked(hasBlockedIp)
const mockCreateToken = jest.mocked(createToken)
const mockParseToken = jest.mocked(parseToken)
const mockFetchWebsite = jest.mocked(fetchWebsite)
const mockFetchWebsiteByHostname = jest.mocked(fetchWebsiteByHostname)
const mockCreateSession = jest.mocked(createSession)
const mockSaveEvent = jest.mocked(saveEvent)
const mockSaveSessionData = jest.mocked(saveSessionData)

function createEventRequest() {
  return new Request('http://localhost/api/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-surgenta-cache': 'cached-session-token',
    },
    body: JSON.stringify({
      type: 'event',
      payload: {
        website: WEBSITE_ID,
        hostname: 'example.com',
        url: '/',
        title: 'Example',
        screen: '1440x900',
      },
    }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIsClickhouseEnabled.mockReturnValue(false)
  mockParseToken.mockReturnValue({
    websiteId: WEBSITE_ID,
    sessionId: SESSION_ID,
    visitId: VISIT_ID,
    iat: Math.floor(Date.now() / 1000),
  })
  mockGetClientInfo.mockResolvedValue({
    ip: '127.0.0.1',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'Mac OS',
    device: 'desktop',
    country: 'US',
    region: 'US-CA',
    city: 'San Francisco',
  })
  mockHasBlockedIp.mockReturnValue(false)
  mockUuid.mockReturnValue(SESSION_ID)
  mockCreateToken.mockReturnValue('next-cache-token')
})

test('creates a relational session before saving an event with a cached token', async () => {
  const response = await POST(createEventRequest())

  expect(response.status).toBe(200)
  expect(mockCreateSession).toHaveBeenCalledWith(
    expect.objectContaining({
      id: SESSION_ID,
      websiteId: WEBSITE_ID,
      createdAt: expect.any(Date),
    }),
  )
  expect(mockSaveEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      websiteId: WEBSITE_ID,
      sessionId: SESSION_ID,
      visitId: VISIT_ID,
    }),
  )
  expect(mockCreateSession.mock.invocationCallOrder[0]).toBeLessThan(
    mockSaveEvent.mock.invocationCallOrder[0],
  )
  expect(mockFetchWebsite).not.toHaveBeenCalled()
  expect(mockFetchWebsiteByHostname).not.toHaveBeenCalled()
  expect(mockSaveSessionData).not.toHaveBeenCalled()
})

test('repeats the conflict-safe session insert for repeated cached events', async () => {
  await POST(createEventRequest())
  await POST(createEventRequest())

  expect(mockCreateSession).toHaveBeenCalledTimes(2)
  expect(mockSaveEvent).toHaveBeenCalledTimes(2)
})
