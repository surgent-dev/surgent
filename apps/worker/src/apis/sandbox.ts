"use node"

import { Daytona, Sandbox } from "@daytonaio/sdk"

export type SandboxFs = Sandbox["fs"]
export type SandboxGit = Sandbox["git"]

export interface DaytonaConfig {
  apiKey?: string
  snapshot?: string
  serverUrl?: string
}

export class SandboxInstance {
  readonly sandboxId: string
  readonly fs: SandboxFs
  readonly git: SandboxGit

  constructor(private sandbox: Sandbox) {
    this.sandboxId = sandbox.id
    this.fs = sandbox.fs
    this.git = sandbox.git
  }

  // Alias for sandboxId
  get id() {
    return this.sandboxId
  }

  async exec(command: string, options?: { timeoutSeconds?: number; cwd?: string; env?: Record<string, string> }) {
    const res = await this.sandbox.process.executeCommand(command, options?.cwd, options?.env, options?.timeoutSeconds)
    return { exitCode: res.exitCode ?? 0, result: res.result }
  }

  async getHost(port: number) {
    return (await this.sandbox.getPreviewLink(port)).url
  }
}

export class DaytonaSandboxProvider {
  private client?: Daytona

  constructor(private config: DaytonaConfig) {}

  private getClient() {
    this.client ??= new Daytona({ apiKey: this.config.apiKey, apiUrl: this.config.serverUrl })
    return this.client
  }

  async create(envs?: Record<string, string>, name?: string) {
    const sandbox = await this.getClient().create({
      snapshot: this.config.snapshot,
      envVars: envs ?? {},
      public: true,
      autoStopInterval: 15,
      ...(name && { name }),
    })
    return new SandboxInstance(sandbox)
  }

  async resume(id: string) {
    const sandbox = await this.getClient().get(id)
    const state = String(sandbox.state || "").toUpperCase()

    if (state === "STOPPED" || state === "ARCHIVED") {
      await sandbox.start()
    }

    return new SandboxInstance(sandbox)
  }

  async get(id: string) {
    return new SandboxInstance(await this.getClient().get(id))
  }

  async stop(id: string) {
    const sandbox = await this.getClient().get(id)
    await sandbox.stop()
  }

  async delete(id: string) {
    const sandbox = await this.getClient().get(id)
    await sandbox.delete()
  }
}

export function createDaytonaProvider(config: DaytonaConfig) {
  return new DaytonaSandboxProvider(config)
}
