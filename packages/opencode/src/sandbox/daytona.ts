import path from "path";
import { Daytona } from "@daytonaio/sdk";
import type { Sandbox, SpawnOptions, SpawnResult } from "./index";

interface FileInfo {
  isDir?: boolean;
  isDirectory?: boolean;
  is_dir?: boolean;
  isFile?: boolean;
  is_file?: boolean;
  size?: number;
  modTime?: string;
  mod_time?: string;
  mtime?: string;
}

interface FileEntry {
  name: string;
  isDir?: boolean;
  isDirectory?: boolean;
  is_dir?: boolean;
}

interface DaytonaFs {
  getFileDetails(p: string): Promise<FileInfo>;
  downloadFile(p: string): Promise<string | ArrayBuffer | Uint8Array>;
  uploadFile(content: Buffer, p: string): Promise<void>;
  createFolder(p: string, mode: string): Promise<void>;
  deleteFile(p: string): Promise<void>;
  listFiles(p: string): Promise<FileEntry[]>;
  setFilePermissions(p: string, mode: string | { mode: string }): Promise<void>;
}

interface DaytonaProc {
  executeCommand(
    cmd: string,
    cwd: string,
    env?: Record<string, string>,
    timeout?: number,
  ): Promise<{ stdout?: string; stderr?: string; result?: string; exitCode?: number }>;
  createSession?(id: string): Promise<void>;
  executeSessionCommand?(
    id: string,
    params: Record<string, unknown>,
  ): Promise<{ cmdId?: string; id?: string; commandId?: string; exitCode?: number }>;
  getSessionCommandLogs?(
    id: string,
    cmdId: string,
    onOut: (s: string) => void,
    onErr: (s: string) => void,
  ): Promise<{ stdout?: string; stderr?: string; exitCode?: number }>;
  stopSessionCommand?(id: string, cmdId: string): Promise<void>;
  killSessionCommand?(id: string, cmdId: string): Promise<void>;
  deleteSession?(id: string): Promise<void>;
}

interface DaytonaSandbox {
  fs: DaytonaFs;
  process: DaytonaProc;
  state?: string;
  start?(): Promise<void>;
}

export interface DaytonaSandboxOptions {
  sandboxId: string;
  root?: string;
  apiKey?: string;
  serverUrl?: string;
}

export function createDaytonaSandbox(opts: DaytonaSandboxOptions): Sandbox {
  const root = path.resolve(opts.root ?? "/home/user/workspace");
  const resolve = (...parts: string[]) => path.resolve(root, ...parts);
  const isDir = (i: FileInfo | FileEntry) => Boolean(i.isDir ?? i.isDirectory ?? i.is_dir);
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
  const isNotFound = (err: unknown) => {
    const anyErr = err as { statusCode?: number; response?: { status?: number }; message?: unknown };
    if (anyErr?.statusCode === 404 || anyErr?.response?.status === 404) return true;
    const message = String(anyErr?.message ?? err);
    return message.includes("ENOENT") || message.includes("not found") || message.includes("no such file or directory");
  };

  const ready = (async (): Promise<DaytonaSandbox> => {
    const client = new Daytona({
      apiKey: opts.apiKey ?? process.env.DAYTONA_API_KEY,
      apiUrl: opts.serverUrl ?? process.env.DAYTONA_API_URL,
    });
    const sandbox = (await client.get(opts.sandboxId)) as unknown as DaytonaSandbox;
    const state = String(sandbox.state ?? "").toUpperCase();
    if ((state === "STOPPED" || state === "ARCHIVED") && sandbox.start) {
      await sandbox.start();
    }
    await sandbox.process.executeCommand(`mkdir -p ${JSON.stringify(root)}`, "/");
    return sandbox;
  })();

  function shell(cmd: string[], stdin?: string) {
    const quoted = cmd.map((s) => JSON.stringify(s)).join(" ");
    return stdin ? `printf %s ${JSON.stringify(stdin)} | ${quoted}` : quoted;
  }

  function cleanEnv(env?: Record<string, string | undefined>) {
    if (!env) return undefined;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (v !== undefined) clean[k] = v;
    }
    return clean;
  }

  async function run(cmd: string[], o: SpawnOptions = {}): Promise<SpawnResult> {
    const { process: proc } = await ready;
    const timeout = o.timeoutMs ? Math.ceil(o.timeoutMs / 1000) : undefined;

    const res = await proc.executeCommand(shell(cmd, o.stdin), o.cwd ? resolve(o.cwd) : root, cleanEnv(o.env), timeout);

    const stdout = res?.stdout ?? res?.result ?? "";
    const stderr = res?.stderr ?? "";

    if (stdout) o.onStdout?.(stdout);
    if (stderr) o.onStderr?.(stderr);

    return { stdout, stderr, exitCode: res?.exitCode ?? 0 };
  }

  async function spawn(cmd: string[], o: SpawnOptions = {}): Promise<SpawnResult> {
    const { process: proc } = await ready;

    if (!proc.createSession || !proc.executeSessionCommand || !proc.getSessionCommandLogs) {
      return run(cmd, o);
    }

    const sessionId = `opencode-${crypto.randomUUID()}`;
    await proc.createSession(sessionId);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let aborted = false;

    const cwd = o.cwd ? resolve(o.cwd) : undefined;
    const baseCommand = shell(cmd, o.stdin);
    const sessionCommand = cwd ? `cd ${JSON.stringify(cwd)} && ${baseCommand}` : baseCommand;
    const command = await proc.executeSessionCommand(sessionId, {
      command: sessionCommand,
      runAsync: true,
      ...(o.env && { env: cleanEnv(o.env) }),
      ...(o.timeoutMs && { timeoutSeconds: Math.ceil(o.timeoutMs / 1000) }),
    });

    const cmdId = command.cmdId ?? command.id ?? command.commandId;

    function stop() {
      if (!cmdId) return;
      // Wrap in try-catch - session may already be cleaned up by Daytona
      try {
        proc.stopSessionCommand?.(sessionId, cmdId)?.catch?.(() => {});
        proc.killSessionCommand?.(sessionId, cmdId)?.catch?.(() => {});
        proc.deleteSession?.(sessionId)?.catch?.(() => {});
      } catch {
        // Ignore - session already gone
      }
    }

    if (o.signal?.aborted) {
      aborted = true;
      stop();
    } else {
      o.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          stop();
        },
        { once: true },
      );
    }

    const timer = o.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          stop();
        }, o.timeoutMs + 100)
      : undefined;

    try {
      if (cmdId) {
        try {
          const logs = await proc.getSessionCommandLogs(
            sessionId,
            cmdId,
            (c) => {
              stdout += c;
              o.onStdout?.(c);
            },
            (c) => {
              stderr += c;
              o.onStderr?.(c);
            },
          );
          stdout ||= logs?.stdout ?? "";
          stderr ||= logs?.stderr ?? "";

          return {
            stdout,
            stderr: timedOut ? `${stderr}\n[timeout]` : stderr,
            exitCode: logs?.exitCode ?? command.exitCode ?? 0,
            timedOut,
            aborted,
          };
        } catch (err) {
          // Session may have been auto-cleaned by Daytona
          if (isNotFound(err)) {
            return { stdout, stderr, exitCode: command.exitCode ?? 0, timedOut, aborted };
          }
          throw err;
        }
      }
      return { stdout, stderr, exitCode: 0, timedOut, aborted };
    } finally {
      if (timer) clearTimeout(timer);
      await proc.deleteSession?.(sessionId).catch(() => {});
    }
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
        try {
          await (await ready).fs.getFileDetails(resolve(p));
          return true;
        } catch (err) {
          if (isNotFound(err)) return false;
          throw err;
        }
      },

      async readText(p) {
        const fullPath = resolve(p);
        try {
          const data = await (await ready).fs.downloadFile(fullPath);
          return typeof data === "string" ? data : new TextDecoder().decode(data);
        } catch (err) {
          if (isNotFound(err)) {
            const error = new Error(`ENOENT: no such file or directory, open '${fullPath}'`);
            (error as { code?: string }).code = "ENOENT";
            throw error;
          }
          throw err;
        }
      },

      async readBytes(p) {
        const fullPath = resolve(p);
        try {
          const data = await (await ready).fs.downloadFile(fullPath);
          if (data instanceof Uint8Array) return data;
          if (data instanceof ArrayBuffer) return new Uint8Array(data);
          return new TextEncoder().encode(data as string);
        } catch (err) {
          if (isNotFound(err)) {
            const error = new Error(`ENOENT: no such file or directory, open '${fullPath}'`);
            (error as { code?: string }).code = "ENOENT";
            throw error;
          }
          throw err;
        }
      },

      async writeText(p, content) {
        await (await ready).fs.uploadFile(Buffer.from(content), resolve(p));
      },

      async writeBytes(p, content) {
        await (await ready).fs.uploadFile(Buffer.from(content), resolve(p));
      },

      async mkdirp(p) {
        await (await ready).fs.createFolder(resolve(p), "755");
      },

      async rm(p) {
        await (await ready).fs.deleteFile(resolve(p));
      },

      async readdir(p) {
        const entries = (await (await ready).fs.listFiles(resolve(p))) ?? [];
        return entries.map((e) => ({
          name: e.name,
          path: resolve(p, e.name),
          isDir: isDir(e),
        }));
      },

      async stat(p) {
        const fullPath = resolve(p);
        let info: FileInfo;
        try {
          info = await (await ready).fs.getFileDetails(fullPath);
        } catch (err) {
          if (isNotFound(err)) {
            const error = new Error(`ENOENT: no such file or directory, open '${fullPath}'`);
            (error as { code?: string }).code = "ENOENT";
            throw error;
          }
          throw err;
        }
        const d = isDir(info);
        const mtime = info.modTime ?? info.mod_time ?? info.mtime;
        return {
          isFile: info.isFile ?? info.is_file ?? !d,
          isDir: d,
          size: info.size ?? 0,
          mtime: mtime ? new Date(mtime) : new Date(),
        };
      },

      async chmod(p, mode) {
        const m = mode.toString(8);
        const fs = (await ready).fs;
        try {
          await fs.setFilePermissions(resolve(p), { mode: m });
        } catch {
          await fs.setFilePermissions(resolve(p), m);
        }
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
