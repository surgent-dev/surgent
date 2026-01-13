# js

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


# OpenCode

AI-powered headless coding agent.

## Stack

| Tool | Purpose |
|------|---------|
| **Bun** | Runtime & package manager |
| **TypeScript** | Language |
| **Hono** | HTTP server |
| **Zod** | Schema validation |
| **Turbo** | Monorepo task runner |
| **Prettier** | Code formatting |
| **Husky** | Git hooks |

## Host vs Workspace

**Host (Global.Path.\*)**
- Machine running the opencode CLI/server process.
- Stores user-level, cross-project data (auth, config, global caches, logs).

**Workspace (Instance.ws.\*)**
- Sandbox where the repo and tools run.
- Stores project data and any tool/binary that must execute in the sandbox.

**Rule of thumb**
- Needs to run inside the repo sandbox → `Instance.ws.*`
- User data or host process deps → `Global.Path.*` / `BunProc`

## Current Change Review (Staged + Unstaged)

File-by-file summary of the sandbox/E2B refactor and related fixes.

- `LEARNING.md`: added a concise agent loop walkthrough.
- `bun.lock`: dependency updates for E2B support and workspace cleanup.
- `packages/opencode/package.json`: adds `e2b`.
- `packages/opencode/src/config/config.ts`: config read/write now sandbox-aware, including `{file:...}` references.
- `packages/opencode/src/config/markdown.ts`: frontmatter parsing reads through sandbox path resolution.
- `packages/opencode/src/file/index.ts`: file status/read/list/search use sandbox fs/proc; mime-aware encoding.
- `packages/opencode/src/file/ripgrep.ts`: prefer sandbox `rg`, run via sandbox proc; avoid shell quoting.
- `packages/opencode/src/file/time.ts`: file mtime checks use sandbox fs.
- `packages/opencode/src/patch/index.ts`: patch read/write/derive use sandbox; derive is async; delete is non-forced.
- `packages/opencode/src/project/instance.ts`: Instance now includes sandbox + sandboxId; cache key includes sandboxId.
- `packages/opencode/src/project/project.ts`: icon discovery reads via sandbox; safe guards around glob.
- `packages/opencode/src/provider/models.local.json`: adds anthropic npm package; Sonnet 4 attachments enabled.
- `packages/opencode/src/provider/provider.ts`: guards missing env list; skip custom loader if base provider missing.
- `packages/opencode/src/pty/index.ts`: PTY feature removed.
- `packages/opencode/src/sandbox/e2b.ts`: new E2B sandbox; extension-based mime map.
- `packages/opencode/src/sandbox/index.ts`: new Sandbox interface + local implementation.
- `packages/opencode/src/server/server.ts`: supports `sandboxId` routing; PTY routes removed.
- `packages/opencode/src/session/prompt.ts`: tool execution wrapped with Instance context; shell execution via sandbox proc.
- `packages/opencode/src/session/system.ts`: only loads `AGENTS.md`/`CLAUDE.md`; config instruction globbing removed.
- `packages/opencode/src/shell/shell.ts`: command args helper; corrected `-l -c` ordering; killTree uses Bun.spawn.
- `packages/opencode/src/skill/skill.ts`: skill scanning constrained to sandbox paths; scan errors handled.
- `packages/opencode/src/tool/bash.ts`: shell resolved per sandbox; execute via sandbox proc; path checks use sandbox.
- `packages/opencode/src/tool/edit.ts`: edit reads/writes via sandbox fs; permission checks use sandbox paths.
- `packages/opencode/src/tool/glob.ts`: sandbox path resolution and mtime stats.
- `packages/opencode/src/tool/grep.ts`: run rg via sandbox proc; stats via sandbox fs.
- `packages/opencode/src/tool/ls.ts`: list uses sandbox path resolution.
- `packages/opencode/src/tool/multiedit.ts`: title uses sandbox relative paths.
- `packages/opencode/src/tool/patch.ts`: patch tool uses sandbox fs; async patch derivation.
- `packages/opencode/src/tool/read.ts`: read uses sandbox fs/mime; binary detection via sandbox bytes.
- `packages/opencode/src/tool/registry.ts`: custom tool scan bounded to sandbox.
- `packages/opencode/src/tool/write.ts`: write uses sandbox fs/path; external dir checks use sandbox.

## Packages

```
packages/
├── opencode/   # Core headless agent server
└── util/       # Shared utilities
```

## Commands

```bash
# Install
bun install

# Dev (runs headless server)
bun dev

# Typecheck
bun run typecheck

# Format
bun run script/format.ts

# Test
bun test
```

## Config

| File | Purpose |
|------|---------|
| `.editorconfig` | Editor settings (indent, line endings) |
| `bunfig.toml` | Bun configuration |
| `turbo.json` | Turbo pipeline config |
| `tsconfig.json` | TypeScript config |
| `package.json` → `"prettier"` | Prettier config (no semi, 120 chars) |

Host vs Workspace — quick mental model

  Host (Global.Path.*)

  - The machine where the opencode CLI/server process runs.
  - Holds user‑level, cross‑project data.
  - Good for:
      - Auth tokens, OAuth sessions
      - User config & rules
      - Global caches for SDKs/providers
      - Logs and model metadata cache
  - Example paths: Global.Path.data, Global.Path.cache, Global.Path.bin

  Workspace (Instance.ws.*)

  - The sandbox where the user’s repo and tools run.
  - Holds project‑specific data and anything that must execute in the sandbox.
  - Good for:
      - Project files
      - Tool installs executed inside the sandbox (LSP servers, formatters, rg)
      - Snapshots & per‑repo data
  - Example access: Instance.ws.fs, Instance.ws.proc, Instance.ws.env, Instance.ws.global.*

  ———

  1. Host server bootstraps and owns the process.
  2. A workspace provider is created per repo.
  3. All file/exec operations that touch repo or tools go through Instance.ws.
  4. User data and shared caches stay on the host (Global.Path.*).

  Workspace‑scoped execution

  - Use Instance.ws.proc.exec/spawn
  - Use Instance.ws.env.execPath for Bun
  - Use Instance.ws.fs for file IO
  - Use Instance.ws.global.{bin,cache,data} for workspace tool dirs

  Host‑scoped execution

  - Use BunProc.run/install (host Bun, global cache)
  - Use Global.Path.* for global data/cache/bin

  ———

  ## Current decisions (as of now)

  - Provider SDKs (AWS, etc): host‑scoped
    (BunProc.install into Global.Path.cache, imported by host process)
  - Formatters & LSP installs:
    workspace‑scoped (run inside sandbox)
