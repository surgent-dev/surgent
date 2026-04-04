# Convex 1.32-1.34 Research

Date: 2026-03-28

## Current Surgent baseline

- Surgent is pinned to `convex@1.31.6`.
- Surgent already provisions Convex projects and deployments itself through the Convex Management API.
- Surgent already syncs Convex environment variables into deployments.
- Surgent already exposes a Convex MCP endpoint for project-scoped tooling.

Relevant code:

- `package.json`
- `apps/worker/src/apis/convex.ts`
- `apps/worker/src/lib/convex-env.ts`
- `apps/worker/src/mcp/convex.ts`
- `apps/worker/src/routes/mcp.ts`

## What shipped after Surgent's current version

### Convex 1.32

1. `npx convex insights`
   - New CLI command for deployment health over the last 72 hours.
   - Focuses on OCC conflicts and resource limit issues.
   - Also shipped as an MCP tool.

2. Project-local local-backend state
   - Local backend data moved from global user storage to a project-local `.convex` directory.
   - Main consequence: separate git worktrees now get isolated local Convex state.
   - This is highly relevant for Surgent's sandbox + branch/worktree workflows.

3. Fine-grained pagination controls
   - `PaginationOptions` now supports `maximumRowsRead` and `maximumBytesRead`.
   - This gives tighter control over expensive paginated queries.

4. Region selection for new deployments
   - CLI can choose region when creating deployments.
   - The release also coincides with Convex's first non-US region rollout.

### Convex 1.33.0

1. Better env workflows
   - `npx convex env set` can set values interactively, from files, or from stdin.
   - `npx convex env list` now round-trips cleanly to files.
   - This enables deployment-to-deployment env copying and safer secret sync flows.

2. Auto-start local backend
   - `npx convex env set` and `npx convex run` now start the local backend if needed.
   - This removes a common failure mode in automated sandbox scripts.

3. Agent-friendly init
   - `npx convex init` was added.
   - `CONVEX_AGENT_MODE=anonymous` allows non-interactive initialization for coding agents.
   - Practical effect: agents can bootstrap Convex locally without a human login ceremony.

4. Lower config clobber risk
   - CLI no longer overwrites `tsconfig.json` / `README.md` in `convex/` when configuring an existing project.

### Convex 1.34.0

1. Convex AI files
   - `npx convex dev` can provision Convex-specific AI context automatically.
   - New `npx convex ai-files` command manages install, update, status, disable, enable, and remove.
   - It maintains `convex/_generated/ai/guidelines.md`, managed sections in `AGENTS.md` / `CLAUDE.md`, and agent skills.

2. Deployment management commands
   - `npx convex deployment create`
   - `npx convex deployment select`
   - All CLI commands now support `--deployment`.
   - This makes per-branch, per-agent, and cross-project targeting much more explicit.

3. Better deployment targeting
   - `--deployment` accepts direct deployment names, refs like `dev/james`, `dev`, `prod`, and cross-project selectors.
   - This is the biggest usability unlock for multi-deployment workflows.

### Related February 2026 improvement

1. EU region hosting
   - Convex launched hosting in Dublin (`aws-eu-west-1`) on all plans, including free.
   - Region selection is available in dashboard, Management API, and CLI.

## What matters most for Surgent

### 1. Local Convex becomes much more usable inside worktrees and ephemeral sandboxes

This is the biggest practical shift.

Surgent already creates isolated workspaces and sandboxes. Before 1.32, local Convex state living outside the repo made worktree-heavy development much messier. After 1.32, every project/worktree can carry its own `.convex` state. That makes local Convex far more compatible with:

- per-branch sandboxes
- multiple concurrent agent sessions
- debugging without cross-worktree contamination
- disposable previews and experiments

### 2. Convex is now meaningfully more agent-native

Between `CONVEX_AGENT_MODE=anonymous`, `npx convex init`, auto-started local backend support, and managed AI files, Convex is now designed to work much better with Codex/Claude/Cursor-style flows.

That matters for Surgent because Surgent is itself an agentic platform.

### 3. Convex deployment handling is less custom-API-only than before

Surgent still needs the Management API for SaaS provisioning on behalf of customers. But the new CLI deployment flows reduce how much internal glue has to exist inside sandboxes and agent workflows.

You can increasingly let the Convex CLI own:

- selecting the active dev deployment
- creating extra branch/dev/preview deployments
- targeting specific deployments with `--deployment`
- round-tripping env vars between deployments

### 4. Convex observability is now closer to usable inside Surgent's agent loop

`npx convex insights` plus the corresponding MCP tool is the missing piece for "debug the backend health, not just the code." This is exactly the kind of tool an agent can call after a deploy or while triaging production issues.

## Concrete ways Surgent can level up its Convex game

### P0: Upgrade the monorepo to Convex 1.34.x

Reason:

- Surgent is currently on `1.31.6`.
- The relevant developer-experience improvements are concentrated in `1.32`, `1.33`, and `1.34`.
- Almost every recommendation below assumes those features exist.

### P0: Add a "local Convex mode" to sandbox/project bootstrap

Suggested bootstrap path for agent-first projects:

1. `bun i`
2. `CONVEX_AGENT_MODE=anonymous bunx convex init`
3. `bunx convex env set < .env.defaults`
4. `CONVEX_AGENT_MODE=anonymous bunx convex dev --once`

Why this matters:

- no human login required
- no shared machine-global backend state
- far better fit for ephemeral environments

This should likely be an optional project mode, not a forced default for every project.

### P0: Expose `insights` in Surgent's own Convex tooling surface

Surgent already has a project-scoped Convex MCP endpoint. Add an explicit path so agents and users can ask:

- why is this deployment slow?
- are OCC conflicts spiking?
- are resource limits causing retries or failures?

Best end-state:

- one-click "Inspect Convex health"
- agent tool can fetch insights before suggesting indexes/query rewrites

### P1: Use Convex deployment refs as first-class branch environments

Surgent should map:

- git branch or workspace branch
- Convex deployment ref
- selected active sandbox deployment

Example:

- `main` -> default prod
- `feature/foo` -> `dev/feature-foo`
- ephemeral preview -> preview deployment or dedicated dev deployment

The new `deployment create`, `deployment select`, and `--deployment` support make this much easier to operationalize cleanly.

### P1: Stop relying only on handwritten deployment targeting logic inside sandboxes

Today Surgent creates deployments through the Management API and persists `CONVEX_DEPLOYMENT`, `CONVEX_URL`, and `CONVEX_DEPLOY_KEY`.

That should remain for platform provisioning.

But inside a sandbox, prefer using the Convex CLI to:

- select the active target deployment
- run commands against explicit deployments
- duplicate env vars safely between deployments

This reduces drift between Surgent's internal expectations and official Convex workflows.

### P1: Add region awareness to Convex provisioning

Surgent's current `createDeployment` wrapper only sends `{ type }`.

That misses the new region capability.

You should consider:

- storing region preference on project/account
- defaulting EU customers to Dublin
- surfacing region during Convex project creation or environment creation

### P1: Add env promotion / cloning workflows

1.33 made env workflows much stronger.

This unlocks productized flows like:

- clone development secrets into a fresh branch deployment
- promote env vars from dev to prod with review
- export env vars for backup/debugging

This is especially useful because Surgent already stores env vars centrally.

### P2: Install and manage Convex AI files deliberately

Convex AI files are useful, but Surgent already has its own `AGENTS.md` conventions.

Recommendation:

- do not blindly auto-install them everywhere
- test them in Convex-heavy templates
- check whether Convex-managed AGENTS/CLAUDE sections conflict with Surgent's own rules

Likely best approach:

- enable in Convex-first templates
- optionally expose a toggle in sandbox bootstrap
- keep Surgent's higher-level platform instructions authoritative

### P2: Use new pagination controls in generated Convex apps

For Convex-backed apps with large feeds or logs, set `maximumRowsRead` / `maximumBytesRead` where runaway paginated reads are plausible.

This is not a platform-level feature by itself, but it is valuable in generated app templates and agent codegen.

## Where Surgent already overlaps with these capabilities

### Strong existing foundation

- Surgent already provisions Convex projects and deploy keys.
- Surgent already stores both dev and prod Convex env vars.
- Surgent already syncs env vars into Convex deployments.
- Surgent already has a Convex MCP server entrypoint.

### Main current gaps

- old Convex package version
- no region parameter in deployment creation
- no explicit use of `insights`
- no obvious exploitation of project-local `.convex` state
- no explicit use of `deployment create` / `deployment select` / `--deployment`
- no agent-mode bootstrap path in sandbox setup
- no deliberate policy for Convex AI files

## Recommended rollout order

1. Upgrade Convex to `1.34.x`.
2. Add a local-agent Convex bootstrap path for sandboxes.
3. Add Convex insights into Surgent's MCP / diagnostics UX.
4. Add region selection to deployment provisioning.
5. Add branch-aware deployment selection and env promotion flows.
6. Decide where Convex AI files should be enabled, instead of letting them appear implicitly.

## Sources

- Convex 1.32 release: https://ship.convex.dev/changelog/convex-1-32
- Convex 1.33.0 release: https://ship.convex.dev/changelog/convex-1-33-0
- Convex 1.34.0 release: https://ship.convex.dev/changelog/convex-1-34-0
- EU region hosting: https://ship.convex.dev/changelog/eu-region-hosting-dublin
- Convex CLI docs: https://docs.convex.dev/cli
- Convex AI docs: https://docs.convex.dev/ai
- Convex regions docs: https://docs.convex.dev/production/regions
- Convex package changelog and CLI help from `convex@1.34.0`
