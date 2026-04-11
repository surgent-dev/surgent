import { Sandbox as E2BSandbox } from 'e2b'
import { templateName } from '@/e2b/template'
import type { Sandbox, SandboxProvider, FileInfo } from './types'

class E2BSandboxImpl implements Sandbox {
  readonly id: string

  constructor(private sbx: E2BSandbox) {
    this.id = sbx.sandboxId
  }

  async exec(cmd: string, opts?: { timeout?: number; cwd?: string; env?: Record<string, string> }) {
    const res = await this.sbx.commands
      .run(cmd, {
        cwd: opts?.cwd,
        envs: opts?.env,
        timeoutMs: opts?.timeout,
      })
      .catch((e: { exitCode?: number; stdout?: string; stderr?: string }) => {
        if (typeof e.exitCode === 'number')
          return { exitCode: e.exitCode, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
        throw e
      })
    return {
      code: res.exitCode ?? 0,
      output: [res.stdout, res.stderr].filter(Boolean).join('\n'),
    }
  }

  async read(path: string) {
    return Buffer.from(await this.sbx.files.read(path, { format: 'bytes' }))
  }

  async list(path: string): Promise<FileInfo[]> {
    return (await this.sbx.files.list(path)).map((f) => ({
      name: f.name,
      path: f.path,
      isDir: f.type === 'dir',
    }))
  }

  async stat(path: string): Promise<FileInfo> {
    const f = await this.sbx.files.getInfo(path)
    return { name: f.name, path: f.path, isDir: f.type === 'dir' }
  }

  async clone(url: string, dir: string) {
    const res = await this.exec(
      `git clone --depth 1 ${JSON.stringify(url)} ${JSON.stringify(dir)}`,
      {
        timeout: 120_000,
      },
    )
    if (res.code !== 0) {
      throw new Error(`Failed to clone repository: ${res.output || 'git clone exited non-zero'}`)
    }
  }

  host(port: number) {
    return `https://${this.sbx.getHost(port)}`
  }

  async pause() {
    await this.sbx.betaPause()
  }

  kill() {
    return this.sbx.kill()
  }
}

export class E2BProvider implements SandboxProvider {
  constructor(private template = templateName) {}

  async create(env?: Record<string, string>, name?: string) {
    const sbx = await E2BSandbox.betaCreate(this.template, {
      envs: env ?? {},
      metadata: name ? { name } : undefined,
      autoPause: true,
    })
    return new E2BSandboxImpl(sbx)
  }

  async resume(id: string) {
    return new E2BSandboxImpl(await E2BSandbox.connect(id))
  }

  async kill(id: string) {
    await E2BSandbox.kill(id)
  }
}
