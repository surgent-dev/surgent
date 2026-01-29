import { Daytona, Sandbox as DaytonaSandbox } from '@daytonaio/sdk'
import type { Sandbox, SandboxProvider, FileInfo } from './types'

class DaytonaSandboxImpl implements Sandbox {
  readonly id: string

  constructor(private sbx: DaytonaSandbox) {
    this.id = sbx.id
  }

  async exec(cmd: string, opts?: { timeout?: number; cwd?: string; env?: Record<string, string> }) {
    const res = await this.sbx.process.executeCommand(cmd, opts?.cwd, opts?.env, opts?.timeout)
    return { code: res.exitCode ?? 0, output: res.result }
  }

  read(path: string) {
    return this.sbx.fs.downloadFile(path)
  }

  async list(path: string): Promise<FileInfo[]> {
    const entries = await this.sbx.fs.listFiles(path)
    return entries.map((f: { name: string; path?: string; isDir?: boolean; type?: string }) => ({
      name: f.name,
      path: f.path,
      isDir: f.isDir === true || f.type === 'directory',
    }))
  }

  async stat(path: string): Promise<FileInfo> {
    const f = (await this.sbx.fs.getFileDetails(path)) as {
      name: string
      path?: string
      isDir?: boolean
      type?: string
    }
    return { name: f.name, path: f.path, isDir: f.isDir === true || f.type === 'directory' }
  }

  clone(url: string, dir: string) {
    return this.sbx.git.clone(url, dir)
  }

  async host(port: number) {
    return (await this.sbx.getPreviewLink(port)).url
  }

  pause() {
    return this.sbx.stop()
  }

  kill() {
    return this.sbx.delete()
  }
}

export class DaytonaProvider implements SandboxProvider {
  private client?: Daytona

  constructor(
    private apiKey?: string,
    private serverUrl?: string,
    private snapshot?: string,
  ) {}

  private getClient() {
    this.client ??= new Daytona({ apiKey: this.apiKey, apiUrl: this.serverUrl })
    return this.client
  }

  async create(env?: Record<string, string>, name?: string) {
    const sbx = await this.getClient().create({
      snapshot: this.snapshot,
      envVars: env ?? {},
      public: true,
      autoStopInterval: 15,
      ...(name && { name }),
    })
    return new DaytonaSandboxImpl(sbx)
  }

  async resume(id: string) {
    const sbx = await this.getClient().get(id)
    const state = String(sbx.state || '').toUpperCase()
    if (state === 'STOPPED' || state === 'ARCHIVED') await sbx.start()
    return new DaytonaSandboxImpl(sbx)
  }

  async kill(id: string) {
    const sbx = await this.getClient().get(id)
    await sbx.delete()
  }
}
