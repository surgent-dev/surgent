## Business Context

Surgent is a vibe coding platform that handles the entire flow of vibe coding apps - dev environments, AI agents, frontend, backend, deployments, database, and payments. The goal is to enable customers to create and publish their apps end-to-end with Surgent.

For detailed architecture, refer to docs/ARCHITECTURE.md.

### Key Components

- @apps/web — Next.js frontend
- @apps/worker — Bun + Hono backend, orchestrates everything (including payments)
- @apps/dispatch — Cloudflare Worker router for customer apps
- @packages/gateway — AI token streaming and usage tracking
- @packages/db — Shared database client (Kysely + Postgres)

### Search tooling

- Text: `rg -n -S "<text>" <dir>`
- TS/TSX structure: `ast-grep --lang ts[x] -p "<pattern>" <dir>`

## Code Philosophy (apply to every code change)

- **Modularity** — Simple parts, clean interfaces. No god functions or mega-modules.
- **Clarity over cleverness** — Readable code wins. No tricks that need comments to explain.
- **Composition** — Design pieces that connect to other pieces, not monoliths.
- **Separation** — Policy from mechanism, interfaces from engines.
- **Simplicity** — Add complexity only when you must. Three similar lines > premature abstraction.
- **Parsimony** — Small, focused programs. Big only when proven necessary.
- **Transparency** — Make state visible. Design for easy inspection and debugging.
- **Robustness** — Comes from transparency + simplicity, not defensive over-engineering.
- **Representation** — Fold knowledge into data so logic stays simple and robust.
- **Least surprise** — Interfaces should do what users expect. No magic behavior.
- **Silence** — No noise. Output only when something meaningful needs saying.
- **Repair** — Fail loud and early. Never swallow errors silently.
- **Economy** — Conserve programmer time over machine time.
- **Generation** — Write programs to write programs when it reduces hand-hacking.
- **Optimize last** — Get it working first. Polish after profiling.
- **Diversity** — No "one true way". Pick the right tool for the job.
- **Extensibility** — Design for the future without over-engineering the present.

## Style Guide

- Keep fixes minimal and readable; avoid adding complexity unless it solves a real problem.
- Do not over-engineer types; avoid extra type checks/conversions unless lint requires it.
- Use shadcn/ui for UI styling.
- Always use bun for package management.
- Never use `as unknown as any` cast.
- Try to keep things in one function unless composable or reusable.
- DO NOT do unnecessary destructuring of variables.
- DO NOT use `else` statements unless necessary.
- DO NOT use `try`/`catch` if it can be avoided.
- AVOID using `any` type.
- AVOID `let` statements.
- PREFER single word variable names where possible.
- Use as many Bun APIs as possible like `Bun.file()`.
- GIT COMMIT - Never commit changes unless explicitly asked. Keep commit messages short (one line, no body). Focus on why something was done. Only commit changes related to the task.
- **Follow how prior code was written** to maintain consistency, including how `;` and `"` are used. Use semicolons and double quotation marks whenever possible.

## Verification

- NEVER verify changes by running a full build (e.g. `bun run build --filter=web`). Always use the linter/type-checker (`ReadLints` or `bun lint`) to validate correctness instead.

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Plans

- For plans, write them into docs/plans with the suffix <plan-name>.plan.md, include references to internal/external sources of reference.
- When designing planning documents, challenge the user on design decisions, ask them critical questions and ask for more information if missing.
- When implementing plans, start by asking the user questions to clarify if the design doc isn't specific, also ask the user which are the most important references to read through if plan does not specify.
