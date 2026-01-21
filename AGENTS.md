### Search tooling

- Text: `rg -n -S "<text>" <dir>`
- TS/TSX structure: `ast-grep --lang ts[x] -p "<pattern>" <dir>`

### Style

- Keep fixes minimal and readable; avoid adding complexity unless it solves a real problem.

-Plase dont do extra type checkes and type conversion unless there is issue in lint. do not overengineer types. Just write concise elegant minimalistic code.

-Use shadcn/ui for UI styling.

-Always use bun for package management.

-Never use as unknown as any cast.

## Style Guide

- Try to keep things in one function unless composable or reusable
- DO NOT do unnecessary destructuring of variables
- DO NOT use `else` statements unless necessary
- DO NOT use `try`/`catch` if it can be avoided
- AVOID `try`/`catch` where possible
- AVOID `else` statements
- AVOID using `any` type
- AVOID `let` statements
- PREFER single word variable names where possible
- Use as many bun apis as possible like Bun.file()
- GIT COMMIT - Never commit changes unless explicitly asked to do so. Keep commit messages short (one line, no description body). Focus on why something was done. Only commit changes related to the task at hand.
- **Follow how prior code was written** to maintain consistency, including how ; and " are used in files. use semi colons and double quotations marks whenever possible

## Debugging

- To test opencode in the `packages/opencode` directory you can run `bun dev`

## SDK

To regenerate the javascript SDK, run ./packages/sdk/js/script/build.ts

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Plans

- For plans, write them into docs/plans with the suffix <plan-name>.plan.md, include references to internal/external sources of reference.
- When designing planning documents, challenge the user on design decisions, ask them critical questions and ask for more information if missing.
- When implementing plans, start by asking the user questions to clarify if the design doc isn't specific, also ask the user which are the most important references to read through if plan does not specify.
