import { afterEach, describe, expect, mock, test } from 'bun:test'

const sandboxExec = mock(async () => ({ code: 0, output: '' }))
const sandboxStat = mock(async () => {
  throw new Error('missing')
})
const sandboxHost = mock(() => 'https://3000-resumed-sandbox.e2b.app')
const resumedSandbox = {
  id: 'resumed-sandbox',
  exec: sandboxExec,
  stat: sandboxStat,
  host: sandboxHost,
}
const providerCreate = mock(async () => ({
  id: 'new-sandbox',
  host: () => 'https://3000-new-sandbox.e2b.app',
}))
const providerResume = mock(async () => resumedSandbox)
const providerKill = mock(async () => {})
const getProvider = mock(() => ({
  create: providerCreate,
  resume: providerResume,
  kill: providerKill,
}))
const upsertSandbox = mock(async () => {})

mock.module('@/lib/config', () => ({
  config: {
    analytics: {},
    cloudflare: {},
    deploy: { buildTimeoutMs: 600_000, convexTimeoutMs: 420_000 },
    opencode: {
      baseUrl: 'https://opencode.test',
      configDir: '/home/user/opencode-config',
      configRepoUrl: 'https://github.com/surgent-dev/opencode-config.git',
    },
    surgent: { baseUrl: 'https://surgent.test' },
  },
}))
mock.module('@/lib/db', () => ({ db: {} }))
mock.module('@/lib/auth', () => ({ auth: {} }))
mock.module('@/lib/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
}))
mock.module('@/lib/sandbox', () => ({
  getProvider,
  workspacePath: (projectId: string) => `/home/user/workspace/${projectId}`,
}))
mock.module('@/services/projects', () => ({
  getEnvVarsByProjectId: mock(async () => []),
  getProjectById: mock(async () => ({ metadata: {} })),
  upsertSandbox,
}))
mock.module('@/lib/convex-env', () => ({
  ensureConvexProdDeployment: mock(async () => {}),
  getConvexCredentials: mock(async () => null),
  syncServerVarsToConvex: mock(async () => {}),
  toEnvMap: () => ({}),
}))
mock.module('@/apis/deployer/deploy', () => ({
  buildDeploymentConfig: mock(() => ({})),
  deployToDispatch: mock(async () => {}),
  parseWranglerConfig: mock((config: unknown) => config),
}))
mock.module('@/apis/deployer/deployer', () => ({
  WorkerDeployer: class {
    deleteWorker = mock(async () => {})
  },
}))
mock.module('@/apis/deployer/utils/index', () => ({ calculateFileHash: mock(() => 'hash') }))
mock.module('@/services/analytics', () => ({ ensureAnalytics: mock(async () => ({ id: 'site' })) }))

const { ensurePm2Process, resumeProject } = await import('../projects')

afterEach(() => {
  getProvider.mockClear()
  providerCreate.mockClear()
  providerResume.mockClear()
  providerResume.mockImplementation(async () => resumedSandbox)
  providerKill.mockClear()
  upsertSandbox.mockClear()
  sandboxExec.mockClear()
  sandboxStat.mockClear()
  sandboxHost.mockClear()
})

describe('ensurePm2Process', () => {
  test('throws when PM2 cannot start the process', async () => {
    const sandbox = {
      exec: mock(async () => ({ code: 1, output: 'missing cwd' })),
    }

    await expect(
      ensurePm2Process(sandbox as any, '/missing', 'web', 'bun run preview'),
    ).rejects.toThrow('Failed to start web (exit 1)')
  })
})

describe('resumeProject', () => {
  test('does not create a blank replacement sandbox when resume fails', async () => {
    providerResume.mockImplementationOnce(async () => {
      throw new Error('sandbox unavailable')
    })

    await expect(
      resumeProject({
        projectId: '0b2e96ce-d8f3-4932-95f8-2ddfc0f7988e',
        sandboxId: 'missing-sandbox',
        provider: 'e2b',
      }),
    ).rejects.toThrow('sandbox unavailable')

    expect(providerCreate).not.toHaveBeenCalled()
    expect(upsertSandbox).not.toHaveBeenCalled()
  })

  test('resumes and saves through the stored provider', async () => {
    await resumeProject({
      projectId: '0b2e96ce-d8f3-4932-95f8-2ddfc0f7988e',
      sandboxId: 'daytona-sandbox',
      provider: 'daytona',
    })

    expect(getProvider).toHaveBeenCalledWith('daytona')
    expect(providerResume).toHaveBeenCalledWith('daytona-sandbox')
    expect(upsertSandbox).toHaveBeenCalledWith({
      id: 'resumed-sandbox',
      projectId: '0b2e96ce-d8f3-4932-95f8-2ddfc0f7988e',
      provider: 'daytona',
      status: 'started',
      host: 'https://3000-resumed-sandbox.e2b.app',
    })
  })
})
