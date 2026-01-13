### Search tooling

- Text: `rg -n -S "<text>" <dir>`
- TS/TSX structure: `ast-grep --lang ts[x] -p "<pattern>" <dir>`

## Style

- Keep fixes minimal and readable; avoid adding complexity unless it solves a real problem.
- Plase dont do extra type checkes and type conversion unless there is issue in lint. do not overengineer types. Just write concise elegant minimalistic code.
- Use shadcn/ui for UI styling.
- Always use bun for package management.
- Never use as unknown as any cast.
- Try to keep things in one function unless composable or reusable
- DO NOT do unnecessary destructuring of variables
- AVOID `else` statements unless necessary
- AVOID `try`/`catch` where possible
- AVOID using `any` type
- AVOID `let` statements
- PREFER single word variable names where possible
- Use as many bun apis as possible like Bun.file()
- GIT COMMIT - Never commit changes unless explicitly asked to do so. And focus on why and what something was done rather than what was done. And only commit changes that are related to the task at hand.
- Follow consistency in coding style, and try not to change from using double quotations marks(") and semicolons(;) in all .ts files

## Debugging

- To test opencode in the `packages/opencode` directory you can run `bun dev`

## SDK

To regenerate the javascript SDK, run ./packages/sdk/js/script/build.ts

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
