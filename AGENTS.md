### Search tooling

- Files: `fd <pattern> <dir>`
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


## Debugging

- To test opencode in the `packages/opencode` directory you can run `bun dev`

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
