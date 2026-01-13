import * as nodepath from "path"
import * as os from "os"
import fs from "fs/promises"
import { Shell } from "../shell/shell"

export interface Sandbox {
  root: string
  contains(p: string): boolean

  path: {
    join(...parts: string[]): string
    resolve(...parts: string[]): string
    relative(from: string, to: string): string
    relativeToRoot(to: string): string
    normalize(p: string): string
    dirname(p: string): string
    basename(p: string, ext?: string): string
    extname(p: string): string
    isAbsolute(p: string): boolean
  }

  fs: {
    exists(p: string): Promise<boolean>
    readText(p: string): Promise<string>
    readBytes(p: string): Promise<Uint8Array>
    writeText(p: string, content: string): Promise<void>
    writeBytes(p: string, content: Uint8Array): Promise<void>
    mkdirp(p: string): Promise<void>
    rm(p: string, opts?: { recursive?: boolean; force?: boolean }): Promise<void>
    readdir(p: string): Promise<Array<{ name: string; path: string; isDir: boolean }>>
    stat(p: string): Promise<{ isFile: boolean; isDir: boolean; size: number; mtime: Date }>
    chmod(p: string, mode: number): Promise<void>
    mime(p: string): string | undefined
  }

  proc: {
    run(cmd: string[], opts?: SpawnOptions): Promise<SpawnResult>
    spawn(cmd: string[], opts?: SpawnOptions): Promise<SpawnResult>
    which(bin: string): Promise<string | undefined> | string | undefined
  }

  env: {
    all(): Record<string, string | undefined>
    get(key: string): string | undefined
    set(key: string, value: string): void
    remove(key: string): void
  }

  os: {
    platform: NodeJS.Platform
    arch: string
    homedir: string
    tmpdir: string
    username: string
  }
}

export type SpawnOptions = {
  cwd?: string
  env?: Record<string, string | undefined>
  stdin?: string
  timeoutMs?: number
  detached?: boolean
  signal?: AbortSignal
  onStdout?(chunk: string): void
  onStderr?(chunk: string): void
}

export type SpawnResult = {
  stdout: string
  stderr: string
  exitCode: number
  timedOut?: boolean
  aborted?: boolean
}

export function create(root: string): Sandbox {
  const resolve = (...parts: string[]) => nodepath.resolve(root, ...parts)

  const spawnProcess = async (cmd: string[], opts: SpawnOptions = {}): Promise<SpawnResult> => {
    const proc = Bun.spawn(cmd, {
      cwd: opts.cwd ? resolve(opts.cwd) : root,
      env: { ...process.env, ...opts.env },
      stdin: opts.stdin ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: opts.detached ?? false,
    })

    if (opts.stdin && proc.stdin) {
      proc.stdin.write(opts.stdin)
      const endResult = proc.stdin.end()
      if (endResult instanceof Promise) {
        await endResult
      }
    }

    let timedOut = false
    let aborted = false
    let exited = false

    const kill = async () => {
      await Shell.killTree(proc, { exited: () => exited })
    }

    const abortHandler = opts.signal
      ? () => {
          aborted = true
          void kill()
        }
      : undefined

    if (opts.signal) {
      if (opts.signal.aborted) {
        aborted = true
        void kill()
      } else if (abortHandler) {
        opts.signal.addEventListener("abort", abortHandler, { once: true })
      }
    }

    const timeout = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          void kill()
        }, opts.timeoutMs)
      : undefined

    const readStream = async (
      stream: ReadableStream<Uint8Array> | null,
      onChunk?: (chunk: string) => void,
    ) => {
      if (!stream) return ""
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let result = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (text) {
          result += text
          onChunk?.(text)
        }
      }
      const tail = decoder.decode()
      if (tail) {
        result += tail
        onChunk?.(tail)
      }
      return result
    }

    const exitCodePromise = proc.exited.then((code) => {
      exited = true
      return code
    })

    const [stdout, stderr, exitCode] = await Promise.all([
      readStream(proc.stdout, opts.onStdout),
      readStream(proc.stderr, opts.onStderr),
      exitCodePromise,
    ])

    if (timeout) clearTimeout(timeout)
    if (opts.signal && abortHandler) {
      opts.signal.removeEventListener("abort", abortHandler)
    }

    if (timedOut) return { stdout, stderr: stderr + "\n[timeout]", exitCode, timedOut, aborted }
    return { stdout, stderr, exitCode, timedOut, aborted }
  }

  return {
    root,

    contains(p: string): boolean {
      return !nodepath.relative(root, nodepath.resolve(root, p)).startsWith("..")
    },

    path: {
      join: (...parts) => nodepath.join(...parts),
      resolve: (...parts) => resolve(...parts),
      relative: (from, to) => nodepath.relative(from, to),
      relativeToRoot: (to) => nodepath.relative(root, to),
      normalize: (p) => nodepath.normalize(p),
      dirname: (p) => nodepath.dirname(p),
      basename: (p, ext) => nodepath.basename(p, ext),
      extname: (p) => nodepath.extname(p),
      isAbsolute: (p) => nodepath.isAbsolute(p),
    },

    fs: {
      exists: (p) => Bun.file(resolve(p)).exists(),

      readText: (p) => Bun.file(resolve(p)).text(),

      async readBytes(p) {
        return new Uint8Array(await Bun.file(resolve(p)).arrayBuffer())
      },

      writeText: (p, content) => Bun.write(resolve(p), content).then(() => {}),
      writeBytes: (p, content) => Bun.write(resolve(p), content).then(() => {}),

      async mkdirp(p) {
        await fs.mkdir(resolve(p), { recursive: true })
      },

      async rm(p, opts = {}) {
        await fs.rm(resolve(p), { recursive: true, force: true, ...opts })
      },

      async readdir(p) {
        const entries = await fs.readdir(resolve(p), { withFileTypes: true })
        return entries.map((entry) => ({
          name: entry.name,
          path: resolve(p, entry.name),
          isDir: entry.isDirectory(),
        }))
      },

      async stat(p) {
        const file = Bun.file(resolve(p))
        const s = await file.stat()
        return { isFile: s.isFile(), isDir: s.isDirectory(), size: s.size, mtime: s.mtime }
      },

      chmod: (p, mode) => fs.chmod(resolve(p), mode),

      mime: (p) => Bun.file(resolve(p)).type || undefined,
    },

    proc: {
      run: (cmd, opts = {}) => spawnProcess(cmd, opts),
      spawn: (cmd, opts = {}) => spawnProcess(cmd, opts),

      which: (bin) => Bun.which(bin) ?? undefined,
    },

    env: {
      all: () => process.env as Record<string, string | undefined>,
      get: (key) => process.env[key],
      set: (key, value) => {
        process.env[key] = value
      },
      remove: (key) => {
        delete process.env[key]
      },
    },

    os: {
      platform: process.platform,
      arch: process.arch,
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
      username: os.userInfo().username,
    },
  }
}

export { createE2BSandbox } from "./e2b"
export { createDaytonaSandbox } from "./daytona"

export type SandboxProvider = "e2b" | "daytona"

function parseSandboxId(sandboxId: string): { provider: SandboxProvider; id: string } {
  const [prefix, ...rest] = sandboxId.split(":")
  if (prefix === "daytona" && rest.length) return { provider: "daytona", id: rest.join(":") }
  if (prefix === "e2b" && rest.length) return { provider: "e2b", id: rest.join(":") }
  return { provider: "e2b", id: sandboxId }
}

export async function createRemoteSandbox(sandboxId: string, root?: string): Promise<Sandbox> {
  const { provider, id } = parseSandboxId(sandboxId)

  if (provider === "daytona") {
    const { createDaytonaSandbox } = await import("./daytona")
    return createDaytonaSandbox({ sandboxId: id, root })
  }

  const { createE2BSandbox } = await import("./e2b")
  return createE2BSandbox({ sandboxId: id, root })
}
