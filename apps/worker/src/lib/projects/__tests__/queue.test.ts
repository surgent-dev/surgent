import { expect, mock, test } from 'bun:test'

const createQueue = mock(async () => {})
const work = mock(async () => {})
const send = mock(async () => 'activation-job-id')
const boss = { createQueue, work, send }

mock.module('@/lib/boss', () => ({ getBoss: () => boss }))
mock.module('@/lib/config', () => ({ config: { cloudflare: {} } }))
mock.module('@/lib/logger', () => ({
  createLogger: () => ({ info() {}, warn() {}, error() {} }),
}))
mock.module('@/apis/browser-rendering', () => ({
  captureScreenshot: mock(async () => new Uint8Array()),
  ScreenshotError: class extends Error {},
}))
mock.module('@/controllers/project-create', () => ({
  runProjectCreationJob: mock(async () => {}),
}))
mock.module('@/controllers/projects', () => ({
  deployProject: mock(async () => {}),
  resumeProject: mock(async () => {}),
}))
mock.module('@/lib/storage', () => ({
  storage: {
    generateKey: () => 'key',
    upload: mock(async () => {}),
    getPublicUrl: () => 'https://example.com/image.jpg',
    getSignedUrl: mock(async () => 'https://example.com/image.jpg'),
  },
}))
mock.module('@/services/projects', () => ({}))

const { enqueueProjectActivationJob, registerProjectWorkers } = await import('../queue')

test('activation jobs are deduplicated per project while queued or running', async () => {
  await registerProjectWorkers()

  expect(createQueue).toHaveBeenCalledWith('project.activate', {
    policy: 'exclusive',
    retryLimit: 3,
    retryBackoff: true,
    expireInSeconds: 900,
    retentionSeconds: 604_800,
  })

  const data = {
    projectId: 'project-id',
    sandboxId: 'sandbox-id',
    provider: 'daytona',
  }
  expect(await enqueueProjectActivationJob(data)).toBe('activation-job-id')
  expect(send).toHaveBeenCalledWith('project.activate', data, {
    singletonKey: 'project-id',
  })
})
