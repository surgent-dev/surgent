## Business Context

Surgent is a vibe coding platform that handles the entire flow of vibe coding apps - dev environments, AI agents, frontend, backend, deployments, database, and payments. The goal is to enable customers to create and publish their apps end-to-end with Surgent.

For detailed architecture, refer to docs/ARCHITECTURE.md.

### Key Components

- @apps/web — Next.js frontend
- @apps/worker — Bun + Hono backend, orchestrates everything
- @apps/pay — Rust payment backend (Surpay)
- @apps/dispatch — Cloudflare Worker router for customer apps
- @packages/gateway — AI token streaming and usage tracking
- @packages/db — Shared database client (Kysely + Postgres)

### Search tooling

- Text: `rg -n -S "<text>" <dir>`
- TS/TSX structure: `ast-grep --lang ts[x] -p "<pattern>" <dir>`

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

## Debugging

- To test opencode in the `packages/opencode` directory you can run `bun dev`

## SDK

To regenerate the javascript SDK, run ./packages/sdk/js/script/build.ts

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Rust

- DO NOT EDIT .sqlx/ by hand. Use `cargo prepare` to generate offline sqlx queries.
- DO NOT run migrations by hand, DO NOT edit database directly.
- Always run `cargo fmt` after rust code changes
- Do not leave comments if the code is easy to understand, leave comments if logic is complicated or the behavior is not immediately obvious.
- Run tests faster with `cargo nextest run`

## Plans

- For plans, write them into docs/plans with the suffix <plan-name>.plan.md, include references to internal/external sources of reference.
- When designing planning documents, challenge the user on design decisions, ask them critical questions and ask for more information if missing.
- When implementing plans, start by asking the user questions to clarify if the design doc isn't specific, also ask the user which are the most important references to read through if plan does not specify.
