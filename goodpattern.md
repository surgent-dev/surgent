# Surgent Good Pattern

## Goal

New code should feel flat, obvious, and hard to misuse.

The pattern is:

```txt
request -> auth/load parent -> command/query -> dto -> response
```

No hidden fallbacks. No giant route files. No UI components that secretly own protocols. No `any` except at a narrow external boundary.

## Core Rules

### 1. Routes Are Transport Only

A route handler may:

- validate request input
- require auth
- load the parent record
- call one command/query
- return a response

A route handler may not:

- orchestrate five product steps
- know third-party API details
- write unrelated child records directly
- parse opaque metadata repeatedly
- swallow background failures

Good route:

```ts
projects.post('/', zValidator('json', createProjectBody), async (c) => {
  const actor = requireActor(c)
  const input = c.req.valid('json')

  const project = await createProjectForOrganization({
    actor,
    organizationId: actor.organizationId,
    input,
  })

  return c.json({ id: project.id })
})
```

Bad route:

```ts
projects.post('/', async (c) => {
  // validates, checks membership, checks billing, creates project,
  // creates api keys, writes env vars, ensures analytics, queues jobs,
  // catches dispatch errors, updates status, maps errors
})
```

### 2. Load Ownership Once

Use one loader for a boundary.

```ts
const project = await loadProjectForMember({
  projectId,
  userId: actor.userId,
  organizationId: actor.organizationId,
})
```

After this, child commands should derive ownership from `project`.

Bad:

```ts
await updateEnvVar({
  projectId,
  organizationId,
  userId,
  key,
  value,
})
```

Good:

```ts
await updateProjectEnvVar({
  project,
  key,
  value,
})
```

The parent is the boundary. Do not duplicate the boundary on every child operation.

### 3. Commands Own Product Workflows

Use commands for writes:

```txt
create-project.ts
request-deploy.ts
update-project-env.ts
connect-github-repo.ts
create-checkout.ts
process-webhook-event.ts
```

A command should:

- accept plain data
- perform one product action
- return plain data
- throw typed errors for expected failures

Example:

```ts
export async function requestProjectDeployment(input: {
  project: ProjectForMember
  deployName?: string
}) {
  const scriptName = resolveDeployScriptName(input.deployName)
  await assertHostnameAvailable(scriptName, input.project.id)

  const deployment = await createDeploymentRecord(input.project.id, scriptName)
  await enqueueProjectDeployJob({
    projectId: input.project.id,
    deploymentId: deployment.id,
    deployName: scriptName,
  })

  return { deploymentId: deployment.id, status: deployment.status }
}
```

### 4. Queries Return Read Models

Queries should return the shape the caller needs. Do not make components or routes assemble complicated cross-table response shapes.

```ts
const projects = await listProjectsForDashboard(actor.organizationId, actor.userId)
return c.json(projects.map(toProjectSummaryDto))
```

Keep SQL close to the query function. Keep DTO conversion close to the route or query, not scattered inside components.

### 5. No Hidden Fallbacks

This is the rule:

- If failure changes user-visible behavior, throw or return a typed error.
- If fallback is product policy, name it in config and log it.
- If cleanup is best-effort, say that in the function name or comment and log failure.
- If data is optional, model it as optional data, not an exception.

Bad:

```ts
try {
  await syncEnvVarsToConvexForEnv(projectId, environment)
} catch {}
```

Good:

```ts
await syncEnvVarsToConvexForEnv(projectId, environment).catch((error) => {
  log.warn({ projectId, environment, error }, 'convex env sync failed')
  return markProjectNeedsEnvResync(projectId, environment)
})
```

Allowed:

```tsx
if (!visible) return null
```

Rendering `null` for an absent UI state is fine. Hiding operational failure is not.

### 6. Use `unknown` At Boundaries, Not `any` Everywhere

External JSON starts as `unknown`.

```ts
const payload = webhookPayloadSchema.parse(await c.req.json())
```

Provider adapters can inspect unknown JSON in a tiny parser:

```ts
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProviderParseError('Expected object')
  }
  return value
}
```

Do not pass `any` through business code. Parse once, then use named types.

### 7. Config Fails Fast In Production

Local defaults are okay. Production defaults for auth, billing, deploy, analytics, and webhook security are not okay.

Good:

```ts
export const config = loadConfig(process.env)
validateProductionConfig(config)
```

Production validation should fail startup when any critical value is missing.

Examples of critical values:

- database URL
- auth secret and base URL
- client origin and trusted origins
- Stripe secret and webhook secret
- Whop API keys and webhook secrets
- Cloudflare account/token/namespace/domain
- analytics URL/token when analytics is enabled
- GitHub app secrets when GitHub routes are enabled

### 8. UI Components Render, Hooks Coordinate

React components should not own protocols.

Bad component responsibilities:

- parse SSE frames
- normalize backend event variants
- merge streaming deltas
- classify provider errors
- decide model defaults
- render the whole UI

Good split:

```txt
agent-events/parse-sse.ts
agent-events/normalize-event.ts
agent-stream/reducer.ts
agent-stream/errors.ts
agent-stream/model-selection.ts
components/conversation/conversation.tsx
components/conversation/header.tsx
components/conversation/composer.tsx
```

Component:

```tsx
export function Conversation({ projectId }: Props) {
  const thread = useAgentThread(projectId)
  const composer = useAgentComposer(projectId, thread.sessionId)

  return <ConversationView thread={thread} composer={composer} />
}
```

### 9. Model Selection Has One Source Of Truth

The recent default model bug came from mismatched IDs and defaulting paths. Do not repeat that.

Use one value:

```ts
export const DEFAULT_AGENT_MODEL = {
  providerId: 'openai',
  modelId: 'gpt-5.4',
  variant: 'medium',
} as const
```

All model selection should go through one helper:

```ts
export function resolveAgentModelSelection(input: {
  selected?: AgentModelSelection
  available: AgentModel[]
}) {
  if (input.selected && hasModel(input.available, input.selected)) return input.selected
  if (hasModel(input.available, DEFAULT_AGENT_MODEL)) return DEFAULT_AGENT_MODEL
  return input.available[0]
}
```

Test this helper. Do not test it through a full UI flow only.

### 10. Tests Follow Behavior Boundaries

Good test files:

```txt
create-project.test.ts
request-deploy.test.ts
project-env.test.ts
webhook-ingest.test.ts
webhook-payment.test.ts
checkout-idempotency.test.ts
agent-stream-reducer.test.ts
model-selection.test.ts
```

Bad test files:

```txt
webhook.test.ts   // 2100 lines, every pay behavior
projects.test.ts  // every project behavior
```

Test the boundary:

- auth/ownership
- idempotency
- failure status
- data written
- DTO returned

Do not test private helper trivia unless the helper is a pure parser/converter with meaningful edge cases.

## File Size Budget

Use this as a pressure gauge, not a religion:

- route file: 250 lines target, 400 max
- React component: 250 lines target, 400 max
- command/query module: 200 lines target, 350 max
- provider adapter: 300 lines target, 500 max
- test file: 500 lines target, split before 800

If a file exceeds the budget, it needs a reason. "It grew over time" is not a reason.

## Preferred Folder Shape

Worker feature:

```txt
apps/worker/src/projects/
  load-project.ts
  create-project.ts
  request-deploy.ts
  update-project-env.ts
  project.dto.ts
  errors.ts
  __tests__/

apps/worker/src/routes/projects/
  index.ts
  deployments.ts
  env.ts
  convex.ts
  github.ts
  marketplace.ts
```

Web feature:

```txt
apps/web/agent-stream/
  reducer.ts
  errors.ts
  model-selection.ts
  __tests__/

apps/web/components/conversation/
  conversation.tsx
  conversation-view.tsx
  header.tsx
  session-menu.tsx
  composer.tsx
```

Gateway provider:

```txt
packages/gateway/src/routes/zen/common/
  request.ts
  response.ts
  usage.ts

packages/gateway/src/routes/zen/providers/openai/
  request.ts
  response.ts
  stream.ts
  usage.ts
```

## Review Checklist

Before merging code, ask:

- Can I explain the file in one sentence?
- Does each file have one owner concept?
- Does the route only validate, authorize, call, and respond?
- Is the parent ownership loaded once?
- Are child writes deriving ownership from the parent?
- Are production config failures hard failures?
- Are hidden fallbacks removed or made visible?
- Is `any` contained to a boundary parser?
- Does the UI component render instead of managing protocol details?
- Is the test named after behavior, not implementation?
- Did the diff make the surrounding code smaller or clearer?

## When To Push Back

Push back when a change:

- adds another mode flag to a large component
- adds a new fallback without a product reason
- writes child records with copied ownership fields
- adds another `z.any`
- expands a route file that is already oversized
- adds a dependency at the repo root for one workspace
- catches errors without status, logs, or retry state
- treats deployment, billing, or webhook failure as best-effort

## Simple Standard

Code should read like this:

```txt
load the actor
load the parent
check the business rule
do the action
record the result
return the shape the caller needs
```

When the code does that, the repo gets calmer.
