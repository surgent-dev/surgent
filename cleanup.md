# Surgent Cleanup Review

## Verdict

Surgent is not clean enough yet. It works, but the code shape is too wide:

- Worker routes are carrying domain logic, auth, queries, orchestration, third-party calls, and response mapping in the same files.
- Billing and payments have too many concepts in one surface.
- The editor UI has core protocol/state logic mixed with rendering.
- The gateway has the right intent, but provider conversion is too loose and too `any`-heavy.
- Config still hides important production assumptions behind defaults.

The fix is not a bigger framework. The fix is fewer owner files, stricter boundaries, and one obvious flow per feature.

## Review Scope

I reviewed:

- `apps/worker`
- `apps/web`
- `packages/gateway`
- `packages/db`
- `apps/analytics`
- repo scripts, package boundaries, config, tests, and docs

Current rough shape:

- 562 tracked TypeScript/TSX files under `apps`, `packages`, and `infra`
- about 88k lines of tracked TypeScript/TSX in those areas in the current worktree
- 509 matches for `any`/`as any`/`Record<string, any>`/`z.any`
- 17 empty or intentionally silent catch patterns
- 298 matches for `fallback`, `return null`, or `return undefined`

Those numbers are not automatically bad. They show where the repo has learned to survive ambiguity instead of making ownership explicit.

## Top Problems

### 1. `apps/worker/src/routes/projects.ts` Is A Product Surface, Not A Route

`apps/worker/src/routes/projects.ts` is 2108 lines. It contains:

- public marketplace listing reads
- marketplace checkout creation
- project listing and usage aggregation
- project creation
- brand DNA generation
- deploy, undeploy, cancel, resume, health, logs, download
- deployment env vars
- Convex deploy/env/dashboard/insights/functions/deployments
- GitHub install/status/repo connection
- analytics proxying

That file is doing too much. The route has stopped being transport and became the product.

Clean target:

```txt
apps/worker/src/routes/projects/index.ts
apps/worker/src/routes/projects/marketplace.ts
apps/worker/src/routes/projects/usage.ts
apps/worker/src/routes/projects/deployments.ts
apps/worker/src/routes/projects/env.ts
apps/worker/src/routes/projects/convex.ts
apps/worker/src/routes/projects/github.ts

apps/worker/src/projects/load-project.ts
apps/worker/src/projects/create-project.ts
apps/worker/src/projects/deploy-project.ts
apps/worker/src/projects/update-project-env.ts
apps/worker/src/projects/project-usage.ts
```

Rule:

Route handlers should do only this:

1. validate request
2. load authenticated parent
3. call one command/query
4. return a DTO

No route handler should own a multi-step product workflow.

First extraction:

- Move `createProjectApiKey`, project creation, default env var creation, analytics ensure, and enqueue into `apps/worker/src/projects/create-project.ts`.
- Move deployment request logic into `apps/worker/src/projects/request-deploy.ts`.
- Move all `/:id/convex/*` handlers into `routes/projects/convex.ts`.
- Move all `/:id/github/*` handlers into `routes/projects/github.ts`.

### 2. Project Ownership Checks Are Repeated Instead Of Loaded Once

The repo often repeats:

- get active org
- check membership
- load project
- check deleted state
- infer organization/user from row

That creates defensive code everywhere and makes security harder to inspect.

Clean target:

```ts
const project = await loadProjectForMember({
  projectId,
  userId,
  organizationId,
})
```

That loader should return one typed project ownership shape or throw one typed HTTP error. Child records should derive ownership from the loaded project, not re-accept `organizationId` or `userId` unless that is the actual business input.

### 3. Billing Is One Large File With Several Domains Inside It

`apps/worker/src/lib/billing.ts` is 1684 lines. It contains:

- plan catalog
- money conversion
- billing state creation
- Stripe customer sync
- payment method sync
- checkout creation
- topup checkout and payment intent logic
- invoice sync
- refund handling
- feature gates
- credit grants
- snapshots

That is not one module. It is a billing package compressed into one file.

Clean target:

```txt
apps/worker/src/billing/catalog.ts
apps/worker/src/billing/money.ts
apps/worker/src/billing/state.ts
apps/worker/src/billing/snapshot.ts
apps/worker/src/billing/stripe-customer.ts
apps/worker/src/billing/checkout.ts
apps/worker/src/billing/topup.ts
apps/worker/src/billing/invoice-sync.ts
apps/worker/src/billing/feature-gates.ts
apps/worker/src/billing/credits.ts
```

The route should import only verbs:

```ts
createBillingCheckout()
createTopupPaymentIntent()
getBillingSnapshot()
checkBillingFeature()
```

Internal helpers should not leak out of the billing package.

### 4. Pay Routes And Webhooks Are Mixed Together

Pay has three large surfaces:

- `apps/worker/src/routes/pay/index.ts` - 1599 lines
- `apps/worker/src/routes/pay/handlers.ts` - 1245 lines
- `apps/worker/src/routes/pay/__tests__/webhook.test.ts` - 2109 lines

The current structure mixes:

- Whop product CRUD
- account connection
- checkout
- customer/subscription/payment reads
- webhook ingestion
- webhook processing
- transaction ledger writes
- processor fee resolution
- idempotency tests

Clean target:

```txt
apps/worker/src/pay/accounts.ts
apps/worker/src/pay/products.ts
apps/worker/src/pay/checkout.ts
apps/worker/src/pay/webhook-ingest.ts
apps/worker/src/pay/webhook-events.ts
apps/worker/src/pay/ledger.ts
apps/worker/src/pay/customers.ts
apps/worker/src/pay/subscriptions.ts

apps/worker/src/routes/pay/index.ts
apps/worker/src/routes/pay/webhooks.ts
```

Test target:

```txt
apps/worker/src/pay/__tests__/webhook-ingest.test.ts
apps/worker/src/pay/__tests__/webhook-payment.test.ts
apps/worker/src/pay/__tests__/webhook-membership.test.ts
apps/worker/src/pay/__tests__/webhook-refund-dispute.test.ts
apps/worker/src/pay/__tests__/checkout-idempotency.test.ts
```

The current big test file has good behavioral coverage. Keep the coverage, split the fixture setup and stop making one file pay the full complexity tax.

### 5. Deployment Orchestration Is Too Coupled

`apps/worker/src/controllers/projects.ts` is 906 lines and combines:

- sandbox access
- archive creation
- asset upload preparation
- Convex deploy
- Cloudflare worker deploy
- analytics sync
- worker cleanup
- deploy status mutation
- resume/start logic
- download/delete/logs/redeploy

Clean target:

```txt
apps/worker/src/deployments/create-deployment.ts
apps/worker/src/deployments/build-project.ts
apps/worker/src/deployments/collect-assets.ts
apps/worker/src/deployments/deploy-cloudflare-worker.ts
apps/worker/src/deployments/sync-convex.ts
apps/worker/src/deployments/finalize-deployment.ts
apps/worker/src/sandboxes/resume-project.ts
apps/worker/src/sandboxes/download-project.ts
```

The deploy command should read top to bottom:

```ts
await markDeploymentStage('starting')
const project = await loadDeployableProject(projectId)
const sandbox = await resumeProjectSandbox(project)
const env = await prepareProductionEnv(project)
await deployConvexIfPresent(project, sandbox, env)
const assets = await buildAndCollectAssets(project, sandbox, env)
await deployWorker(project, deployment, assets, env)
await finalizeDeployment(project, deployment)
```

No hidden cleanup should be swallowed unless the primary operation already succeeded and the cleanup is explicitly best-effort.

### 6. The Editor UI Is A State Machine Hidden Inside Components

Large web files:

- `apps/web/components/conversation.tsx` - 1018 lines
- `apps/web/components/agent/agent-thread.tsx` - 1258 lines
- `apps/web/context/project-events.tsx` - 687 lines
- `apps/web/components/chat-input.tsx` - 580 lines
- `apps/web/components/project-header.tsx` - 797 lines

The editor currently mixes:

- SSE connection and retry policy
- event normalization
- event coalescing
- optimistic messages
- model selection
- billing/context error parsing
- scroll behavior
- input state
- thread rendering
- permissions/questions

Clean target:

```txt
apps/web/agent-events/parse-sse.ts
apps/web/agent-events/normalize-event.ts
apps/web/agent-events/project-event-client.ts
apps/web/agent-stream/reducer.ts
apps/web/agent-stream/errors.ts
apps/web/agent-stream/model-selection.ts
apps/web/components/conversation/conversation.tsx
apps/web/components/conversation/header.tsx
apps/web/components/conversation/session-menu.tsx
apps/web/components/conversation/scroll-region.tsx
apps/web/components/conversation/composer.tsx
```

The component should receive state that is already shaped:

```ts
<ConversationView
  thread={thread}
  composer={composer}
  sessionMenu={sessionMenu}
  status={status}
/>
```

React components should render and call actions. They should not parse provider errors, normalize protocol variants, or decide retry behavior.

### 7. Gateway Provider Conversion Needs A Typed Envelope

`packages/gateway/src/routes/zen/util/provider/openai.ts` and `openai-compatible.ts` rely heavily on `any`. That is understandable at the external API boundary, but the looseness leaks through the whole provider adapter.

Clean target:

```txt
packages/gateway/src/routes/zen/common/request.ts
packages/gateway/src/routes/zen/common/response.ts
packages/gateway/src/routes/zen/providers/openai/request.ts
packages/gateway/src/routes/zen/providers/openai/response.ts
packages/gateway/src/routes/zen/providers/anthropic/request.ts
packages/gateway/src/routes/zen/providers/anthropic/response.ts
```

Rule:

- Use `unknown` at the network boundary.
- Parse once into `CommonRequest`.
- Convert from `CommonRequest` into provider requests.
- Convert provider responses back into `CommonResponse`.
- Keep `any` only inside tiny adapter helpers where upstream JSON is genuinely untyped.

The gateway also has provider fallback logic. That should be product policy, not incidental retry behavior. Fallbacks can be valid, but they must be visible in config and logs because they can change cost, latency, and output behavior.

### 8. Config Has Too Many Production Defaults

`apps/worker/src/lib/config.ts` centralizes env access, which is good. The problem is that production-critical values still have defaults:

- server origins
- sandbox provider/template/domain
- deploy domain
- Stripe plan amounts
- analytics URL behavior
- opencode config repo/dir

Clean target:

```txt
apps/worker/src/config/schema.ts
apps/worker/src/config/load-config.ts
apps/worker/src/config/validate-production-config.ts
```

Rule:

- Local defaults are allowed only in local mode.
- Production config must fail startup when required values are missing.
- Startup warnings are not enough for secrets, billing, deploy, auth, analytics, and webhook verification.

This matches the Twelve-Factor rule that config should live in the environment, but the code still needs to treat missing production config as a hard failure.

### 9. Database Types Need Real JSON Shapes

`packages/db/src/types.ts` has too many JSON columns typed as `any`:

- organization metadata
- billing payloads
- project github/settings/deployment/sandbox
- integration config
- deployment env snapshot
- listing metadata/stats

Clean target:

```txt
packages/db/src/json/project.ts
packages/db/src/json/billing.ts
packages/db/src/json/integration.ts
packages/db/src/json/deployment.ts
```

Use explicit JSON types where the app reads or writes the shape. Use `unknown` only when the app truly stores opaque third-party payloads.

### 10. Analytics Looks Like A Vendored Product

`apps/analytics` is a headless analytics backend added as a large app. It has a separate Prisma/ClickHouse/Redis world and many query files. It may be worth keeping, but it should be treated as a bounded service, not as normal Surgent application code.

Clean target:

- Keep analytics as a service boundary.
- Do not import analytics internals from worker/web.
- Expose only stable HTTP endpoints and a tiny worker client.
- Keep generated Prisma output ignored.
- Keep analytics-specific dependency churn inside `apps/analytics`.

`apps/worker/src/services/analytics.ts` is the right kind of boundary. Keep pushing toward that.

## Delete Or Flatten

Do these before inventing new abstractions:

- Delete old research/docs not needed for product operations. The current worktree already has many `research/*` deletions; that direction is right.
- Remove root dependencies that are only used by one workspace. Put them in the workspace that needs them.
- Collapse duplicate package scripts. Prefer `typecheck`, `build`, `test`, `lint`.
- Remove `check-types` vs `typecheck` duplication unless a tool requires both.
- Split large tests by behavior, not by implementation file.
- Remove empty catch blocks. If the failure is allowed, name it and log or return a typed result.
- Remove `.catch(() => {})` on background work unless the caller records the failure somewhere visible.
- Remove route comments that repeat the path name. The route declaration already says that.
- Keep generated output out of source review and metrics.

## Cleanup Plan

### Phase 1: Make Failure Honest

Goal: remove hidden behavior before moving files.

- Replace empty catches in project deploy, project env sync, project events, provider OAuth, analytics, and storage with explicit handling.
- Convert production config warnings into startup failures for deploy/auth/billing/analytics/webhooks.
- Add one `HttpError`/`AppError` path for worker route failures.
- Make gateway provider fallback emit a structured metric every time it changes provider.

Definition of done:

- no empty `catch {}`
- no `.catch(() => {})` in core write paths
- missing production secrets crash startup
- background jobs write status rows when they fail

### Phase 2: Split Projects

Goal: shrink `routes/projects.ts` below 300 lines.

Order:

1. Extract marketplace routes.
2. Extract project env routes.
3. Extract Convex routes.
4. Extract GitHub routes.
5. Extract deploy routes.
6. Move project creation into a command.
7. Add `loadProjectForMember`.

Definition of done:

- route files contain no direct multi-table workflow
- every child command receives a loaded project or a project id plus a loader
- tests cover ownership, project creation, deploy request, env update

### Phase 3: Split Billing And Pay

Goal: separate subscription billing from embedded pay.

Order:

1. Move Stripe subscription billing to `billing/*`.
2. Move Whop embedded payments to `pay/*`.
3. Move webhook ingestion away from webhook effects.
4. Move ledger writes to one file.
5. Split the 2109-line webhook test into focused behavior tests.

Definition of done:

- `billing` owns Surgent subscription and credits
- `pay` owns customer app payment primitives
- webhook ingestion stores events and enqueues jobs only
- webhook processing is idempotent and testable without Hono route setup

### Phase 4: Split Editor State From Editor UI

Goal: make the conversation view boring.

Order:

1. Move SSE frame parsing to `agent-events/parse-sse.ts`.
2. Move event normalization to `agent-events/normalize-event.ts`.
3. Move connection/reconnect/coalescing to a project event client.
4. Move model defaulting to `agent-stream/model-selection.ts`.
5. Move error classification to `agent-stream/errors.ts`.
6. Split the header, scroll region, session menu, and composer.

Definition of done:

- `Conversation` renders state and actions
- no provider error parsing inside component JSX files
- no event protocol normalization in React context
- model default tests cover default provider/model/variant

### Phase 5: Type Gateway Adapters

Goal: keep upstream JSON weirdness at the edge.

Order:

1. Define `CommonRequest` and `CommonResponse` as the only internal format.
2. Make each provider adapter accept `unknown` and return typed common objects.
3. Remove broad `any` from provider conversion files.
4. Test OpenAI Responses, OpenAI chat-compatible, Anthropic, and Google conversion with fixtures.

Definition of done:

- provider adapters are mostly pure functions
- `any` is isolated to tiny parser helpers
- fallback provider behavior is visible and intentional

## First 10 PRs I Would Make

1. Add `loadProjectForMember` and use it in two project routes.
2. Extract `routes/projects/convex.ts`.
3. Extract `routes/projects/github.ts`.
4. Extract `projects/create-project.ts`.
5. Extract `projects/request-deploy.ts`.
6. Move billing catalog/money/snapshot into `billing/*`.
7. Split Whop webhook ingestion from webhook processing.
8. Split `webhook.test.ts` into five behavior files.
9. Move `project-events.tsx` SSE parser and normalizer into pure modules with tests.
10. Add production config validation that fails startup for missing critical env vars.

## What Not To Do

- Do not add a service locator.
- Do not add a domain framework.
- Do not turn this into DDD theater.
- Do not create generic repositories for every table.
- Do not keep adding route helpers to already huge route files.
- Do not preserve fallback behavior just because it avoided an exception once.
- Do not split files by "utils"; split by product action and data owner.

## Good External Standards Used

- Twelve-Factor config: config belongs in env, and deploy-varying config should not be hardcoded. https://www.12factor.net/config
- TypeScript narrowing: prefer narrowing `unknown` over spreading `any` through the app. https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Google code review guidance: improve code health over time, keep changes focused, and optimize for maintainability. https://google.github.io/eng-practices/review/
