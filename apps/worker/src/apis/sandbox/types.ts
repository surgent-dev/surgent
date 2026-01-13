export type FileInfo = { name: string; path?: string; isDir: boolean };

export interface Sandbox {
  id: string;
  exec(
    cmd: string,
    opts?: { timeout?: number; cwd?: string; env?: Record<string, string> },
  ): Promise<{ code: number; output: string }>;
  read(path: string): Promise<Buffer>;
  list(path: string): Promise<FileInfo[]>;
  stat(path: string): Promise<FileInfo>;
  clone(url: string, dir: string): Promise<void>;
  host(port: number): string | Promise<string>;
  pause(): Promise<void>;
  kill(): Promise<void>;
}

export interface SandboxProvider {
  create(env?: Record<string, string>, name?: string): Promise<Sandbox>;
  resume(id: string): Promise<Sandbox>;
  kill(id: string): Promise<void>;
}
