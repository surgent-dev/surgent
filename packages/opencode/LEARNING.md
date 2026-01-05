# OpenCode Learning Notes

This document is a concise, repo-specific guide to how the agent loop works.

## Agent Loop: Full Cycle (Start -> Finish)

1) Request enters
- HTTP `POST /session/:id/message` (or command/shell) is handled by the server.
- Each request is scoped to a project instance based on directory.
- See: `packages/opencode/src/server/server.ts`, `packages/opencode/src/project/instance.ts`

2) User message is created
- `SessionPrompt.prompt` creates a user message and parts (text/file/agent/subtask), then persists them.
- If `noReply` is false, the loop begins.
- See: `packages/opencode/src/session/prompt.ts`, `packages/opencode/src/session/index.ts`

3) Loop setup
- `SessionPrompt.loop` enforces a single active run per session (abort controller).
- If already running, new callers are queued as callbacks.
- See: `packages/opencode/src/session/prompt.ts`

4) Context selection
- Loads recent messages (compaction-aware) and finds the last user/assistant.
- Detects pending tasks: subtask or compaction parts.
- See: `packages/opencode/src/session/prompt.ts`, `packages/opencode/src/session/message-v2.ts`

5) Pending task handling
- Subtask: runs `TaskTool`, writes a synthetic user message, then continues.
- Compaction: runs compaction agent, may enqueue a synthetic "continue".
- See: `packages/opencode/src/tool/task.ts`, `packages/opencode/src/session/compaction.ts`

6) Auto-compaction check
- If context is near/over limit, a compaction task is created and loop repeats.
- See: `packages/opencode/src/session/compaction.ts`

7) Normal agent turn
- Picks agent + model, inserts reminders (plan/build switch).
- Builds system prompts: provider prompt + environment + custom instruction files.
- Resolves tools (built-ins + MCP + custom tools), applying permission gates.
- See: `packages/opencode/src/agent/agent.ts`, `packages/opencode/src/session/system.ts`, `packages/opencode/src/tool/registry.ts`, `packages/opencode/src/mcp/index.ts`

8) LLM streaming
- `SessionProcessor.process` calls `LLM.stream` and updates message parts as tokens stream in.
- Tool calls execute and update tool parts; permission requests may block/ask/deny.
- Retry logic handles transient errors with backoff.
- See: `packages/opencode/src/session/processor.ts`, `packages/opencode/src/session/llm.ts`, `packages/opencode/src/permission/index.ts`, `packages/opencode/src/session/retry.ts`

9) Finish
- Usage/cost recorded, assistant message finalized, session status set to idle.
- Optional title/body summaries created; old tool outputs may be pruned.
- See: `packages/opencode/src/session/status.ts`, `packages/opencode/src/session/summary.ts`, `packages/opencode/src/session/compaction.ts`

10) Return to caller
- The loop returns the most recent assistant message to the request.
- See: `packages/opencode/src/session/prompt.ts`

## Notes

- `EditTool`/`WriteTool`: use `Instance.sandbox.path` + `Instance.sandbox.fs`; LSP diagnostics removed (no `../lsp` module in this repo). Files: `packages/opencode/src/tool/edit.ts`, `packages/opencode/src/tool/write.ts`.
