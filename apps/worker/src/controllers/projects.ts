import { E2BProvider, DaytonaProvider } from "@/apis/sandbox";
import type { Sandbox, SandboxProvider } from "@/apis/sandbox";
import { config } from "@/lib/config";
import { createHash } from "crypto";
import { parse as parseDotEnv } from "dotenv";
import path from "path";
import stripJsonComments from "strip-json-comments";
import * as ProjectService from "@/services/projects";
import { buildDeploymentConfig, parseWranglerConfig, deployToDispatch } from "@/apis/deploy";
import { auth } from "@/lib/auth";

const MAX_PROJECTS_PER_USER = 2;

const DEFAULT_WORKER = `export default { 
  async fetch(request, env) { 
    return env.ASSETS.fetch(request); 
  } 
};`;

const DEFAULT_WRANGLER = {
  compatibility_date: "2025-04-24",
  assets: { binding: "ASSETS", not_found_handling: "single-page-application" },
  observability: { enabled: true, head_sampling_rate: 0.1 },
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ============================================================================
// Types
// ============================================================================

export interface InitializeProjectArgs {
  githubUrl: string;
  userId: string;
  name?: string;
  initConvex?: boolean;
  headers?: Headers;
}

export interface ResumeProjectArgs {
  projectId: string;
  sandboxId: string;
}

export interface RunAgentArgs {
  sandboxId: string;
  projectId: string;
  prompt: string;
  sessionId?: string;
  convexSessionId: string;
  model?: string;
  mode?: "build" | "plan";
}

export interface DeployProjectArgs {
  projectId: string;
  deployName?: string;
}

export interface DeleteProjectArgs {
  projectId: string;
}

// ============================================================================
// Helpers
// ============================================================================

const posix = path.posix;

function localWorkspacePath(projectId: string): string {
  return posix.join("/home/user/workspace", projectId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "project");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function buildBashCommand(cwd: string, script: string): string {
  return `bash -lc '${["set -euo pipefail", `cd ${shellQuote(cwd)}`, script].join("\n").replace(/'/g, "'\"'\"'")}'`;
}

type ProviderName = "e2b" | "daytona";

const sandboxProviderName: ProviderName = config.sandbox.provider === "daytona" ? "daytona" : "e2b";

function getSandboxProvider(): SandboxProvider {
  if (config.sandbox.provider === "daytona") {
    return new DaytonaProvider(config.daytona.apiKey, config.daytona.serverUrl, config.daytona.snapshot);
  }
  return new E2BProvider(config.e2b.template);
}

function stripTrailingSlash(s: string): string {
  return s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s;
}

function resolveEntryPath(currentDir: string, entry: unknown): string {
  const info = entry as Record<string, any>;
  if (typeof info.path === "string" && info.path) return info.path;
  const name = typeof info.name === "string" ? info.name : "";
  return name ? posix.join(stripTrailingSlash(currentDir), name) : currentDir;
}

function sanitizeScriptName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

async function directoryExists(sandbox: Sandbox, dir: string): Promise<boolean> {
  try {
    return (await sandbox.stat(dir)).isDir;
  } catch {
    return false;
  }
}

async function downloadFileSafe(sandbox: Sandbox, filePath: string, cwd?: string): Promise<Buffer> {
  try {
    return await sandbox.read(filePath);
  } catch {
    const cmd = `base64 -w0 ${shellQuote(filePath)} 2>/dev/null || base64 ${shellQuote(filePath)}`;
    const res = await sandbox.exec(cmd, { timeout: 60_000, cwd });
    if (res.code !== 0) throw new Error(`downloadFileSafe failed: ${res.output}`);
    return Buffer.from((res.output || "").toString().trim(), "base64");
  }
}

async function collectAssets(sandbox: Sandbox, rootDir: string) {
  const root = stripTrailingSlash(rootDir);
  const manifest: Record<string, { hash: string; size: number }> = {};
  const files: Array<{ path: string; base64: string }> = [];

  async function walk(dir: string) {
    for (const entry of await sandbox.list(dir)) {
      const entryPath = resolveEntryPath(dir, entry);
      if (entry.isDir) {
        await walk(entryPath);
      } else {
        const buffer = await downloadFileSafe(sandbox, entryPath);
        const rel = `/${posix.relative(root, entryPath)}`;
        manifest[rel] = { hash: createHash("sha256").update(buffer).digest("hex").slice(0, 32), size: buffer.length };
        files.push({ path: rel, base64: buffer.toString("base64") });
      }
    }
  }

  await walk(rootDir);
  return { manifest, files };
}

async function pm2JList(sandbox: Sandbox, cwd: string): Promise<any[]> {
  try {
    const out = await sandbox.exec("pm2 jlist", { timeout: 30_000, cwd });
    const parsed = JSON.parse(out.output);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function isPm2Online(sandbox: Sandbox, cwd: string, name: string): Promise<boolean> {
  const list = await pm2JList(sandbox, cwd);
  return list.find((p) => p?.name === name)?.pm2_env?.status === "online";
}

async function ensurePm2Process(sandbox: Sandbox, cwd: string, name: string, command: string, forceRestart = false) {
  if (await isPm2Online(sandbox, cwd, name)) {
    if (forceRestart) await sandbox.exec(`pm2 restart ${name} --update-env`, { timeout: 60_000, cwd });
    return;
  }
  await sandbox.exec(`pm2 start "${command}" --name ${name} --update-env`, { timeout: 300_000, cwd });
}

async function getOrCreateSandbox(opts: {
  port: number;
  workingDirectory: string;
  sandboxId?: string;
  env?: Record<string, string>;
  name?: string;
}) {
  const provider = getSandboxProvider();
  let sandbox: Sandbox;

  if (opts.sandboxId) {
    try {
      sandbox = await provider.resume(opts.sandboxId);
    } catch {
      sandbox = await provider.create(opts.env, opts.name);
    }
  } else {
    sandbox = await provider.create(opts.env, opts.name);
  }

  return { sandbox, previewUrl: await sandbox.host(opts.port) };
}

// ============================================================================
// Main Functions
// ============================================================================

export async function deployProject(args: DeployProjectArgs): Promise<void> {
  const { projectId, deployName: rawName } = args;
  console.log("[deploy] start", { projectId });

  // 1. Load project
  const project = await ProjectService.getProjectById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.sandbox?.id) throw new Error("Sandbox not initialized");

  const scriptName = rawName ? sanitizeScriptName(rawName) : `project-${projectId.slice(0, 8)}`;
  const workingDir = localWorkspacePath(projectId);

  try {
    await ProjectService.updateDeploymentStatus(projectId, "starting", scriptName);

    // 2. Resume sandbox
    const sandbox = await getSandboxProvider().resume(project.sandbox.id);

    // 3. Build
    await ProjectService.updateDeploymentStatus(projectId, "building");
    const build = await sandbox.exec("bun run build", { cwd: workingDir, timeout: 180_000 });
    if (build.code !== 0) {
      await ProjectService.updateDeploymentStatus(projectId, "build_failed");
      throw new Error(`Build failed: ${String(build.output).slice(0, 500)}`);
    }

    // 4. Find assets directory (dist/client or dist/)
    const assetsDir = await findAssetsDir(sandbox, workingDir);
    if (!assetsDir) throw new Error("No dist/ directory found after build");

    // 5. Collect assets
    const { manifest, files } = await collectAssets(sandbox, assetsDir);
    if (!Object.keys(manifest).length) throw new Error("No assets found in dist/");

    // 6. Read env vars (optional)
    const envVars = await readEnvFile(sandbox, `${workingDir}/.env.local`);

    // 7. Deploy to Cloudflare
    await ProjectService.updateDeploymentStatus(projectId, "uploading");

    const wranglerConfig = { name: scriptName, ...DEFAULT_WRANGLER };
    const wrangler = parseWranglerConfig(JSON.stringify(wranglerConfig));
    const deployConfig = buildDeploymentConfig(
      wrangler,
      DEFAULT_WORKER,
      config.cloudflare.accountId!,
      config.cloudflare.apiToken!,
      manifest,
    );

    if (envVars) deployConfig.vars = { ...envVars, ...deployConfig.vars };

    const fileContents = new Map(files.map((f) => [f.path, Buffer.from(f.base64, "base64")]));
    await deployToDispatch(
      { ...deployConfig, dispatchNamespace: config.cloudflare.dispatchNamespace! },
      fileContents,
      undefined,
      wranglerConfig.assets,
    );

    // 8. Update project
    await ProjectService.updateProject(projectId, {
      sandbox: { ...project.sandbox, deployed: true, deployName: scriptName },
      deployment: { status: "deployed", updatedAt: new Date() },
    });

    console.log("[deploy] success", { projectId, scriptName });
  } catch (err: any) {
    console.error("[deploy] failed", { projectId, error: err?.message });
    await ProjectService.updateDeploymentStatus(projectId, "deploy_failed").catch(() => {});
    throw err;
  }
}

async function findAssetsDir(sandbox: Sandbox, workingDir: string): Promise<string | null> {
  const clientDir = `${workingDir}/dist/client`;
  const distDir = `${workingDir}/dist`;

  if (await directoryExists(sandbox, clientDir)) return clientDir;
  if (await directoryExists(sandbox, distDir)) return distDir;
  return null;
}

async function readEnvFile(sandbox: Sandbox, path: string): Promise<Record<string, string> | undefined> {
  try {
    return parseDotEnv(await downloadFileSafe(sandbox, path));
  } catch {
    return undefined;
  }
}

export async function initializeProject(
  args: InitializeProjectArgs,
): Promise<{ projectId: string; sandboxId: string; previewUrl: string }> {
  console.log("[init] starting...", { userId: args.userId, githubUrl: args.githubUrl });
  const projectCount = await ProjectService.countProjectsByUserId(args.userId);
  console.log("[init] project count:", projectCount);
  if (projectCount >= MAX_PROJECTS_PER_USER) {
    throw new HttpError(400, `Project limit reached. Maximum ${MAX_PROJECTS_PER_USER} projects per user.`);
  }

  const created = await ProjectService.createProject({
    userId: args.userId,
    name: args.name || "app",
    githubUrl: args.githubUrl,
  });
  const projectId = created.id;
  const workingDirectory = localWorkspacePath(projectId);

  const apiKeyResult = await auth.api.createApiKey({
    body: { name: `p-${projectId.slice(0, 8)}` },
    headers: args.headers,
  });

  console.log("[init] creating sandbox...");
  const { sandbox, previewUrl } = await getOrCreateSandbox({
    port: 3000,
    workingDirectory,
    name: "server",
    env: { SURGENT_API_KEY: apiKeyResult.key, SURGENT_AI_BASE_URL: "https://ai.surgent.dev" },
  });
  console.log("[init] sandbox created:", sandbox.id, "provider:", sandboxProviderName);

  if (args.githubUrl) {
    console.log("[init] cloning repo...");
    await sandbox.clone(args.githubUrl, workingDirectory);
    console.log("[init] clone complete");
  }

  let initScript: string | undefined;
  let devScript: string | undefined;
  let processName = `${projectId}-vite-server`;
  try {
    console.log("[init] reading surgent.json...");
    const content = (await sandbox.read(`${workingDirectory}/surgent.json`)).toString("utf8");
    console.log("[init] surgent.json found, parsing...");
    const cfg = JSON.parse(stripJsonComments(content));
    initScript = cfg?.scripts?.init;
    devScript = cfg?.scripts?.dev;
    if (cfg?.name?.trim()) processName = cfg.name.trim();
    console.log("[init] config:", { initScript, devScript, processName });
  } catch (err) {
    console.log("[init] no surgent.json or parse error:", err);
  }

  if (initScript) await sandbox.exec(buildBashCommand(workingDirectory, initScript), { timeout: 600_000 });

  if (devScript) {
    await ensurePm2Process(sandbox, workingDirectory, processName, devScript);
  }

  await ProjectService.updateProject(projectId, {
    metadata: { workingDirectory, processName, startCommand: devScript },
    sandbox: { id: sandbox.id, provider: sandboxProviderName, previewUrl, status: "started", isInitialized: true },
  });

  return { projectId, sandboxId: sandbox.id, previewUrl };
}

export async function resumeProject(args: ResumeProjectArgs): Promise<{ sandboxId: string; previewUrl: string }> {
  const workingDirectory = localWorkspacePath(args.projectId);

  const { sandbox, previewUrl } = await getOrCreateSandbox({
    sandboxId: args.sandboxId,
    port: 3000,
    workingDirectory,
    name: "server",
  });

  try {
    const project = await ProjectService.getProjectById(args.projectId);
    const { startCommand, processName } = (project?.metadata ?? {}) as any;

    if (startCommand && processName) {
      await ensurePm2Process(sandbox, workingDirectory, processName, startCommand);
    }
  } catch (err) {
    console.log("[resume] pm2 start error", err);
  }

  return { sandboxId: sandbox.id, previewUrl };
}

export async function deployConvexProd(args: { projectId: string }): Promise<void> {
  const project = await ProjectService.getProjectById(args.projectId);
  if (!project) throw new Error(`Project ${args.projectId} not found`);

  const sandboxId = project.sandbox?.id;
  if (!sandboxId) throw new Error("Sandbox not found");

  const sandbox = await getSandboxProvider().resume(sandboxId);
  const cwd = project.metadata?.workingDirectory || localWorkspacePath(args.projectId);

  const res = await sandbox.exec("bunx convex deploy -y", { cwd, timeout: 180_000 });
  if (res.code !== 0) throw new Error(`convex deploy failed: ${res.output}`);
}

export async function downloadProject(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
  const project = await ProjectService.getProjectById(projectId);
  if (!project) throw new HttpError(404, "Project not found");

  const sandboxId = project.sandbox?.id;
  if (!sandboxId) throw new HttpError(400, "Sandbox not initialized");

  const sandbox = await getSandboxProvider().resume(sandboxId);
  const workingDir = (project.metadata as any)?.workingDirectory || localWorkspacePath(projectId);
  const archivePath = `/tmp/${projectId}-download.tar.gz`;

  // Use tar (always available) with excludes for large/irrelevant directories
  const tarCmd = [
    "tar -czf",
    shellQuote(archivePath),
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=.next",
    "--exclude=dist",
    "--exclude=.turbo",
    "--exclude=*.log",
    ".",
  ].join(" ");

  const result = await sandbox.exec(tarCmd, { cwd: workingDir, timeout: 180_000 });
  if (result.code !== 0) {
    throw new HttpError(500, `Failed to create archive: ${result.output}`);
  }

  const buffer = await downloadFileSafe(sandbox, archivePath, workingDir);

  // Cleanup
  await sandbox.exec(`rm -f ${shellQuote(archivePath)}`).catch(() => {});

  const safeName = (project.name || "project").replace(/[^a-zA-Z0-9_-]/g, "-");
  return { buffer, filename: `${safeName}.tar.gz` };
}

export async function deleteSandbox(args: DeleteProjectArgs): Promise<void> {
  const project = await ProjectService.getProjectById(args.projectId);
  if (!project) return;

  const sandboxId = project.sandbox?.id;
  if (!sandboxId) return;

  try {
    await getSandboxProvider().kill(sandboxId);
    console.log("[delete] sandbox deleted", { projectId: args.projectId, sandboxId });
  } catch (err) {
    console.error("[delete] sandbox deletion failed", { projectId: args.projectId, sandboxId, error: err });
  }
}
