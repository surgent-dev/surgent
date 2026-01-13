import path from "path";
import { Sandbox, TimeoutError } from "e2b";
import type { Sandbox as SandboxType, SpawnOptions, SpawnResult } from "./index";

interface FileEntry {
  name: string;
  path: string;
  type?: string;
  size?: number;
}

export interface E2BSandboxOptions {
  sandboxId: string;
  root?: string;
  timeoutMs?: number;
}

export function createE2BSandbox(opts: E2BSandboxOptions): SandboxType {
  const root = path.resolve(opts.root ?? "/home/user/workspace");
  const resolve = (...parts: string[]) => path.resolve(root, ...parts);
  const isDir = (entry: FileEntry) => entry.type === "dir";
  const EXT_MIME: Record<string, string> = {
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".xml": "application/xml",
  };

  const ready = (async () => {
    const sandbox = opts.timeoutMs
      ? await Sandbox.connect(opts.sandboxId, { timeoutMs: opts.timeoutMs })
      : await Sandbox.connect(opts.sandboxId);
    await sandbox.commands.run(`mkdir -p ${JSON.stringify(root)}`, { timeoutMs: 30_000 });
    return sandbox;
  })();

  function shell(cmd: string[], stdin?: string) {
    const quoted = cmd.map((s) => JSON.stringify(s)).join(" ");
    return stdin ? `printf %s ${JSON.stringify(stdin)} | ${quoted}` : quoted;
  }

  function cleanEnv(env?: Record<string, string | undefined>): Record<string, string> | undefined {
    if (!env) return undefined;
    return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)) as Record<string, string>;
  }

  function errorResult(err: unknown): SpawnResult | undefined {
    const anyErr = err as { exitCode?: number; stdout?: string; stderr?: string };
    if (typeof anyErr.exitCode !== "number") {
      if (err instanceof TimeoutError) {
        return { stdout: "", stderr: "[timeout]", exitCode: 124, timedOut: true };
      }
      return undefined;
    }
    const timedOut = err instanceof TimeoutError;
    const stderr = timedOut ? `${anyErr.stderr ?? ""}\n[timeout]` : (anyErr.stderr ?? "");
    return { stdout: anyErr.stdout ?? "", stderr, exitCode: anyErr.exitCode ?? 0, timedOut };
  }

  async function run(cmd: string[], o: SpawnOptions = {}): Promise<SpawnResult> {
    const sandbox = await ready;
    let stdout = "";
    let stderr = "";
    const res = await sandbox.commands
      .run(shell(cmd, o.stdin), {
        cwd: o.cwd ? resolve(o.cwd) : root,
        envs: cleanEnv(o.env),
        timeoutMs: o.timeoutMs,
        onStdout: (chunk) => {
          stdout += chunk;
          o.onStdout?.(chunk);
        },
        onStderr: (chunk) => {
          stderr += chunk;
          o.onStderr?.(chunk);
        },
      })
      .catch((err) => {
        const fallback = errorResult(err);
        if (fallback) return fallback;
        throw err;
      });

    return {
      stdout: res.stdout ?? stdout,
      stderr: res.stderr ?? stderr,
      exitCode: res.exitCode ?? 0,
      timedOut: "timedOut" in res ? res.timedOut : false,
    };
  }

  async function spawn(cmd: string[], o: SpawnOptions = {}): Promise<SpawnResult> {
    const sandbox = await ready;
    let stdout = "";
    let stderr = "";
    let aborted = false;

    if (o.signal?.aborted) {
      return { stdout, stderr, exitCode: 0, aborted: true };
    }

    const handle = await sandbox.commands.run(shell(cmd, o.stdin), {
      background: true,
      cwd: o.cwd ? resolve(o.cwd) : root,
      envs: cleanEnv(o.env),
      timeoutMs: o.timeoutMs,
      onStdout: (chunk) => {
        stdout += chunk;
        o.onStdout?.(chunk);
      },
      onStderr: (chunk) => {
        stderr += chunk;
        o.onStderr?.(chunk);
      },
    });

    const abortHandler = () => {
      aborted = true;
      void handle.kill().catch(() => {});
    };

    if (o.signal) {
      o.signal.addEventListener("abort", abortHandler, { once: true });
    }

    const res = await handle
      .wait()
      .catch((err) => {
        const fallback = errorResult(err);
        if (fallback) return fallback;
        throw err;
      })
      .finally(() => {
        if (o.signal) {
          o.signal.removeEventListener("abort", abortHandler);
        }
      });

    return {
      stdout: res.stdout ?? stdout,
      stderr: res.stderr ?? stderr,
      exitCode: res.exitCode ?? 0,
      timedOut: "timedOut" in res ? res.timedOut : false,
      aborted,
    };
  }

  return {
    root,

    contains(p) {
      return !path.relative(root, path.resolve(root, p)).startsWith("..");
    },

    path: {
      join: (...parts) => path.join(...parts),
      resolve: (...parts) => resolve(...parts),
      relative: (from, to) => path.relative(from, to),
      relativeToRoot: (to) => path.relative(root, to),
      normalize: (p) => path.normalize(p),
      dirname: (p) => path.dirname(p),
      basename: (p, ext) => path.basename(p, ext),
      extname: (p) => path.extname(p),
      isAbsolute: (p) => path.isAbsolute(p),
    },

    fs: {
      async exists(p) {
        return (await ready).files.exists(resolve(p));
      },

      readText: async (p) => (await ready).files.read(resolve(p)),

      async readBytes(p) {
        return new Uint8Array(await (await ready).files.read(resolve(p), { format: "bytes" }));
      },

      async writeText(p, content) {
        const sandbox = await ready;
        await sandbox.files.write(resolve(p), content);
      },

      async writeBytes(p, content) {
        const sandbox = await ready;
        await sandbox.files.write(resolve(p), content.buffer as ArrayBuffer);
      },

      async mkdirp(p) {
        await (await ready).files.makeDir(resolve(p));
      },

      async rm(p, opts = {}) {
        if (opts.recursive) {
          await run(["rm", "-rf", resolve(p)]);
          return;
        }
        await (await ready).files.remove(resolve(p));
      },

      async readdir(p) {
        const entries = await (await ready).files.list(resolve(p));
        return entries.map((entry) => ({
          name: entry.name,
          path: entry.path ?? resolve(p, entry.name),
          isDir: isDir(entry as FileEntry),
        }));
      },

      async stat(p) {
        const fullPath = resolve(p);
        const info = await (await ready).files.getInfo(fullPath);
        const mtime = info.modifiedTime ? new Date(info.modifiedTime) : new Date();
        return {
          isFile: info.type !== "dir",
          isDir: info.type === "dir",
          size: info.size ?? 0,
          mtime,
        };
      },

      async chmod(p, mode) {
        await run(["chmod", mode.toString(8), resolve(p)]);
      },

      mime: (p) => {
        const ext = path.extname(p).toLowerCase();
        return EXT_MIME[ext];
      },
    },

    proc: {
      run,
      spawn,
      async which(bin) {
        const res = await run(["command", "-v", bin]);
        return res.stdout.trim() || undefined;
      },
    },

    env: {
      all: () => process.env as Record<string, string | undefined>,
      get: (key) => process.env[key],
      set: (key, value) => {
        process.env[key] = value;
      },
      remove: (key) => {
        delete process.env[key];
      },
    },

    os: {
      platform: process.platform,
      arch: process.arch,
      homedir: "/home/user",
      tmpdir: "/tmp",
      username: "user",
    },
  };
}
