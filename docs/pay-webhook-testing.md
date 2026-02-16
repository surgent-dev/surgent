# Pay Webhook System — Testing Reference

## Prerequisites

- Local Postgres: `postgres://surgent:password@localhost:5432/surgent` (or `TEST_DATABASE_URL`)
- No Whop API keys, no external services, no Docker beyond Postgres

```bash
bun test apps/worker/src/routes/pay/__tests__/
```

## Architecture

```
Whop sends webhook
  │
  ▼
POST /api/pay/webhooks/whop
  │
  ├─ verify HMAC signature (webhook-id, webhook-timestamp, webhook-signature)
  ├─ parse JSON body → coerceEvent() extracts typed fields
  ├─ INSERT pay_webhook_event ON CONFLICT DO NOTHING (dedup by event ID)
  ├─ enqueueWebhookJob() → pg-boss queue (singletonKey = eventId)
  └─ return 202
        │
        ▼
  pg-boss worker picks up job
        │
        ▼
  processWebhookEvent(eventId, eventType, parsedEvent)
  │
  ├─ BEGIN TRANSACTION
  ├─ Claim gate: UPDATE status → 'processing' WHERE status IN ('pending','failed')
  │   └─ if not claimed → return (already processed or in-progress)
  ├─ Advisory lock: pg_advisory_xact_lock(hashtext('payment:pay_123'))
  ├─ Dispatch to handler (payment/membership/refund/dispute/invoice/withdrawal/verification)
  ├─ UPDATE status → 'processed', error → null
  └─ COMMIT
        │
        ▼
  On failure: pg-boss retries (5x, exponential backoff)
  After all retries: DLQ worker sets status → 'failed'
```

## Test Files (80 tests total)

### `handlers.test.ts` — 25 pure unit tests

No database, no network. Tests three exported functions with plain JS objects.

**resolveEntityLockKey** — maps event type → lock key for advisory locks

| Test                                   | What it proves                                                  |
| -------------------------------------- | --------------------------------------------------------------- |
| `payment.*` locks on `paymentId`       | `payment.succeeded` + `payment.failed` both lock `payment:{id}` |
| `membership.*` locks on `membershipId` | Lock key: `membership:{id}`                                     |
| `refund.*` locks on `paymentId`        | Refunds share lock with parent payment (prevents race)          |
| `dispute.*` locks on `paymentId`       | Disputes share lock with parent payment                         |
| `invoice.*` locks on `membershipId`    | Invoices share lock with parent membership                      |
| `withdrawal.*` locks on `withdrawalId` | Lock key: `withdrawal:{id}`                                     |
| `verification.*` locks on `companyId`  | Lock key: `company:{id}`                                        |
| Missing entity ID → null               | No lock acquired if ID is absent                                |
| Unknown event type → null              | `foo.bar` → no lock                                             |

**coerceEvent** — parses raw Whop payload into typed `ParsedWhopWebhookEvent`

| Test                         | What it proves                                                      |
| ---------------------------- | ------------------------------------------------------------------- |
| Payment event                | Extracts `paymentId`, converts `total` (dollars) → `amount` (cents) |
| Membership event             | Extracts `membershipId`, `userId` from nested `data.user.id`        |
| Refund event                 | Extracts `refundId` + `paymentId` from `data.payment_id`            |
| Dispute event                | Extracts `disputeId` + `paymentId`                                  |
| Invoice event                | Extracts `invoiceId` + `membershipId` from `data.membership_id`     |
| Withdrawal event             | Extracts `withdrawalId`, converts dollar amount → cents             |
| Verification event           | Extracts `companyId` from nested `data.company.id`                  |
| Unknown type (`foo.bar`)     | Falls through to default branch, still returns ok                   |
| Preserves `data.metadata`    | Metadata passthrough for project routing                            |
| null / string / array / `{}` | Returns `{ ok: false }` — no crash                                  |

**verifySignature** — wraps `composeWhopWebhookSignature` + `verifyWhopWebhookSignature`

| Test                                    | What it proves                           |
| --------------------------------------- | ---------------------------------------- |
| Missing signature header                | Returns `{ ok: false, statusCode: 400 }` |
| Missing `webhook-id` with other headers | 400 — incomplete header set              |
| Invalid HMAC                            | Returns `{ ok: false, statusCode: 401 }` |

### `webhooks.test.ts` — 16 pure unit tests

No database, no network. Tests the raw crypto functions from `@/lib/pay/webhooks`.

**composeWhopWebhookSignature** — assembles `id;timestamp;signature` format

| Test                                        | What it proves                                                  |
| ------------------------------------------- | --------------------------------------------------------------- |
| Compose from separate headers               | `{webhookId, webhookTimestamp, webhookSignature}` → `id;ts;sig` |
| Pass-through composed format                | Already-composed string is returned as-is                       |
| Missing `webhook-signature`                 | Throws (mandatory header)                                       |
| Missing `webhook-id` when timestamp present | Throws (incomplete header set)                                  |
| Missing `webhook-timestamp` when id present | Throws (incomplete header set)                                  |

**verifyWhopWebhookSignature** — HMAC-SHA256 verification with timestamp tolerance

| Test                             | What it proves                                                   |
| -------------------------------- | ---------------------------------------------------------------- |
| Valid signature                  | Returns `{ eventId, timestamp }`                                 |
| Invalid HMAC                     | Throws "invalid webhook signature"                               |
| Timestamp >5min old              | Throws "tolerance" (replay protection)                           |
| Timestamp >5min in future        | Throws "tolerance" (clock skew protection)                       |
| Timestamp at edge (4m59s)        | Passes — boundary is exactly 300s                                |
| Malformed format (no semicolons) | Throws "format"                                                  |
| Wrong secret                     | Throws "invalid webhook signature"                               |
| Multiple signatures, one valid   | Passes — iterates `v1,` prefixed sigs, accepts first valid match |
| `v2,` prefix                     | Throws — only `v1,` is supported                                 |
| `Uint8Array` payload             | Works same as string (binary-safe)                               |
| Custom tolerance (10s)           | 15s-old timestamp rejected with tighter window                   |

### `webhook.test.ts` — 29 integration tests (real Postgres)

Mounts the real Hono routes in-memory. Signs webhooks with a test secret. Reads/writes to real Postgres.

**What's mocked:**

- `@/lib/pay/queue` — `enqueueWebhookJob` captures jobs in an array (no pg-boss)
- `@/lib/config` — injects `webhookSecret: 'test-secret'` (no real Whop keys)
- `@/lib/db` — points to local Postgres via `createClient(DATABASE_URL)`

**What's real:**

- Hono HTTP handler (runs in-process via `app.request()`, no HTTP server)
- Signature verification (self-signed with same test secret)
- All Postgres reads/writes (pay_webhook_event, pay_payment, pay_transaction, etc.)
- `processWebhookEvent()` — called directly to simulate what the pg-boss worker does

#### HTTP layer (signature & validation)

| Test                        | What it proves                                 |
| --------------------------- | ---------------------------------------------- |
| No signature headers → 400  | Rejects unsigned requests                      |
| Wrong signature → 401       | Rejects tampered requests                      |
| Unsupported processor → 404 | `/webhooks/stripe` returns 404                 |
| Invalid JSON → 400          | Malformed body rejected after sig verification |
| Missing event type → 400    | `coerceEvent` failure returns 400              |

#### Deduplication (INSERT ON CONFLICT on event ID)

| Test                                           | What it proves                                     |
| ---------------------------------------------- | -------------------------------------------------- |
| First webhook → 202, inserts pending, enqueues | Happy path                                         |
| Duplicate of `processed` → 200, no re-enqueue  | Idempotent — returns OK, doesn't re-process        |
| Duplicate of `pending` → 202, re-enqueues      | Retryable — re-enqueues in case first job was lost |
| Duplicate of `failed` → 202, re-enqueues       | Retryable — failed events get another chance       |
| Duplicate of `processing` → 200, no re-enqueue | In-flight — don't double-process                   |

#### Claim gate (processWebhookEvent)

| Test                                             | What it proves                                  |
| ------------------------------------------------ | ----------------------------------------------- |
| Claims `pending` → sets `processed`              | Normal flow: `pending → processing → processed` |
| Claims `failed` → sets `processed`, clears error | Retry success clears previous error message     |
| Skips already `processed`                        | Claim UPDATE returns 0 rows — no-op             |
| Skips `processing`                               | Another worker has it — no-op                   |

#### Edge cases

| Test                                           | What it proves                                   |
| ---------------------------------------------- | ------------------------------------------------ |
| Unknown event type → still marks processed     | No handler fires, but event isn't stuck          |
| Event not in DB → no-op                        | Claim returns null — graceful, no crash          |
| No entity ID → processes without advisory lock | `resolveEntityLockKey` returns null → skips lock |
| Failed retry clears previous error             | `error` column reset to null on success          |

#### Event type variations

| Test                                        | What it proves                                               |
| ------------------------------------------- | ------------------------------------------------------------ |
| Membership event stores correct `eventType` | `membership.activated` stored, not defaulting to `payment.*` |
| Refund event stores correct `eventType`     | `refund.created` stored correctly                            |
| Dispute event stores correct `eventType`    | `dispute.created` stored correctly                           |

#### Full pipeline (webhook → process → DB records)

| Test                                                          | What it proves                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| Webhook → process → creates `pay_payment` + `pay_transaction` | End-to-end: HTTP → dedup → process → payment row + ledger entry |

#### Handler DB side effects

| Test                                                                                           | What it proves                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `membership.activated` → creates `pay_subscription`                                            | Upserts with `whopMembershipId`, `whopUserId`, `status: active`   |
| `membership.deactivated` → updates to `canceled`                                               | ON CONFLICT DO UPDATE changes status                              |
| `refund.created` → creates `pay_refund` + `pay_transaction(kind=refund, direction=outflow)`    | Refund creates both refund record and outflow ledger entry        |
| `dispute.created` → creates `pay_dispute` + `pay_transaction(kind=dispute, direction=outflow)` | `resolvedAt` is null (unresolved), outflow ledger entry           |
| Payment with `feeAmount > 0` → creates payment tx + processor_fee tx                           | Fee tx has `direction=outflow`, linked via `paymentTransactionId` |
| Payment with `feeAmount = 0` → no processor_fee tx                                             | No phantom fee rows                                               |
| Same payment processed twice → exactly 1 row each                                              | ON CONFLICT DO UPDATE is idempotent — no duplicates               |

### `checkout.test.ts` — 10 integration tests (real Postgres)

Tests checkout idempotency at the DB constraint level. No HTTP handler, no auth, no Whop API.

Creates FK prerequisite rows in `beforeAll` (organization → user → project → pay_account), cleans up in `afterAll`.

#### Idempotency key unique constraint: `(projectId, idempotencyKey)`

| Test                                     | What it proves                                                  |
| ---------------------------------------- | --------------------------------------------------------------- |
| Same key → INSERT ON CONFLICT DO NOTHING | Second insert returns undefined (conflict), first row preserved |
| Null key allows multiple inserts         | SQL `NULL != NULL` — no unique violation, both rows exist       |

#### Stale detection (reserve-first checkout pattern)

| Test                                   | What it proves                                         |
| -------------------------------------- | ------------------------------------------------------ |
| `creating` status >60s old → stale     | Can delete stale + re-insert with same idempotency key |
| `creating` status <60s old → NOT stale | Fresh in-progress checkout is not garbage-collected    |

#### Failed checkout cleanup

| Test                                            | What it proves                                         |
| ----------------------------------------------- | ------------------------------------------------------ |
| Failed checkout deleted → slot freed for retry  | Delete failed → re-insert with same key succeeds       |
| Open/completed checkout → NOT deleted on replay | Existing successful checkout is returned, not replaced |

#### Status transitions

| Test                | What it proves                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| `creating → open`   | Whop API success: sets `whopCheckoutId` + `purchaseUrl` + `status=open` |
| `creating → failed` | Whop API error: `status=failed`, `whopCheckoutId` stays null            |
| `open → completed`  | Payment webhook: `status=completed`, `completedAt` set                  |

#### Race condition

| Test                                         | What it proves                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Two concurrent inserts, same idempotency key | Exactly one wins (gets `id` back), other gets null. Winner's row exists. |

## What's NOT tested (and why)

| Thing                            | Why not                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| Real Whop API calls              | Third-party — flaky, needs test keys, belongs in E2E                     |
| Real pg-boss job lifecycle       | Mocked queue. Could add `queue.test.ts` for enqueue → worker → DLQ flow. |
| Graceful shutdown (`stopBoss`)   | Process lifecycle — test manually                                        |
| Checkout status polling endpoint | Needs auth mocking + Whop API — low risk                                 |

## Cleanup

All test files clean up after themselves:

- `webhook.test.ts`: deletes transactions → refunds/disputes/invoices/subscriptions → payments → events
- `checkout.test.ts`: deletes checkout sessions → pay_account → project → user → organization
- Order respects FK constraints (children before parents)
