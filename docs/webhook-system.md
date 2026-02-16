# Webhook System

How Whop webhooks are received, deduplicated, queued, and processed.

## Architecture

```
Whop API
  │
  ▼
POST /api/pay/webhooks/whop
  │  verify signature (HMAC-SHA256)
  │  parse event
  │  deduplicate (INSERT ON CONFLICT)
  │  enqueue to pg-boss
  ▼
pg-boss queue (webhook.process)
  │  claim gate (atomic UPDATE WHERE status IN pending/failed)
  │  advisory lock (per-entity serialization)
  │  dispatch to handler
  │  upsert entities (ON CONFLICT DO UPDATE)
  ▼
pg-boss DLQ (webhook.dead)
  │  permanent failure after 5 retries
  ▼
pay_webhook_event.status = 'failed'
```

## Full Flow Diagram

```
Whop sends webhook
│  Headers: webhook-id, webhook-timestamp, webhook-signature
│
▼
╔══════════════════════════════════════════════════════════════════╗
║  1. SIGNATURE VERIFICATION                                      ║
║     composeWhopWebhookSignature() → verifyWhopWebhookSignature() ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ webhookSecret not configured?        → 500 (server misconfiguration)
├─ missing webhook-signature header?    → 400 (bad request)
├─ missing webhook-id or timestamp?     → 400 (bad request)
├─ timestamp outside ±5min window?      → 401 (replay attack)
├─ HMAC-SHA256 mismatch?               → 401 (forged)
│  (constant-time comparison via XOR to prevent timing attacks)
│  (supports multiple v1,{sig} entries for secret rotation)
│
▼ valid
╔══════════════════════════════════════════════════════════════════╗
║  2. EVENT PARSING                                                ║
║     JSON.parse(body) → coerceEvent() → ParsedWhopWebhookEvent   ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ invalid JSON?                        → 400 (bad payload)
├─ missing event type?                  → 400 (bad event)
│
│  Extracts entity IDs by event type prefix:
│    payment.*     → paymentId
│    membership.*  → membershipId + paymentId
│    refund.*      → refundId + paymentId
│    dispute.*     → disputeId + paymentId
│    invoice.*     → invoiceId + membershipId
│    withdrawal.*  → withdrawalId
│
│  Amounts normalized to minor units: Math.round(value * 100)
│  eventId from payload or signature header (whichever available)
│
▼
╔══════════════════════════════════════════════════════════════════╗
║  3. DEDUPLICATION — Layer 1 (database)                           ║
║     INSERT pay_webhook_event ON CONFLICT (id) DO NOTHING         ║
╚══════════════════════════════════════════════════════════════════╝
│
├─────────────────────────────┐
│ RETURNING id (new event)    │ null (duplicate — row already exists)
│                             │
│                             ▼
│                     SELECT status WHERE id = :eventId
│                             │
│                     ┌───────┼───────┐
│                     │               │
│              pending/failed    processing/processed
│                     │               │
│              re-enqueue        200 OK (already handled
│              (give it another  or in-flight, don't
│               chance)          re-enqueue)
│                     │
▼                     ▼
╔══════════════════════════════════════════════════════════════════╗
║  4. ENQUEUE — Layer 2 (pg-boss)                                  ║
║     b.send('webhook.process', data, { singletonKey: eventId })   ║
║     singletonKey deduplicates: won't create job if one is active ║
╚══════════════════════════════════════════════════════════════════╝
│
▼ return 202 { ok: true, queued: true }
═══════════════════════════════════════════════════
  HTTP response sent. Everything below is async.
═══════════════════════════════════════════════════
│
▼ pg-boss worker picks up job (pollingIntervalSeconds: 2)
╔══════════════════════════════════════════════════════════════════╗
║  5. CLAIM GATE — Layer 3 (row-level lock)                        ║
║     BEGIN TRANSACTION                                            ║
║     UPDATE pay_webhook_event SET status = 'processing'           ║
║     WHERE id = :eventId AND status IN ('pending', 'failed')      ║
║     RETURNING id                                                 ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ claimed = null?  → return (already processed or in-flight, skip)
│
│  Concurrent safety:
│    Worker A: locks row, sets 'processing', continues
│    Worker B: blocks on row lock, waits...
│    Worker A: commits/continues
│    Worker B: unblocks, PG re-evaluates WHERE (EvalPlanQual)
│              status is now 'processing' → not in ('pending','failed')
│              → 0 rows returned → skip
│
▼ claimed
╔══════════════════════════════════════════════════════════════════╗
║  6. ADVISORY LOCK (per-entity serialization)                     ║
║     SELECT pg_advisory_xact_lock(hashtext(:lockKey))             ║
║     Lock released automatically when transaction ends            ║
╚══════════════════════════════════════════════════════════════════╝
│
│  Lock key by event type:
│    payment.*      → 'payment:{paymentId}'
│    membership.*   → 'membership:{membershipId}'
│    refund.*       → 'payment:{paymentId}'       ← locks PARENT payment
│    dispute.*      → 'payment:{paymentId}'       ← locks PARENT payment
│    invoice.*      → 'membership:{membershipId}' ← locks PARENT subscription
│    withdrawal.*   → 'withdrawal:{withdrawalId}'
│    verification.* → 'company:{companyId}'
│    (no entity ID) → no lock, proceed without serialization
│
│  Effect: payment.succeeded + refund.created for same payment
│          can never run concurrently, even as separate events
│
▼
╔══════════════════════════════════════════════════════════════════╗
║  7. DISPATCH TO HANDLER                                          ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ payment.*
│    ├─ lookup checkout session via metadata.session_id
│    ├─ UPSERT pay_payment ON CONFLICT (whopPaymentId)
│    ├─ upsert pay_customer (if userId or email)
│    └─ if payment.succeeded:
│         ├─ INSERT pay_transaction (kind='payment')
│         │  ON CONFLICT (kind, sourceId) DO UPDATE
│         ├─ INSERT pay_transaction (kind='processor_fee')  ← only if fee > 0
│         │  sourceId = '{paymentId}:processor_fee'
│         └─ UPDATE pay_checkout_session status → 'completed'
│
├─ membership.*
│    ├─ lookup checkout session via metadata.session_id
│    ├─ UPSERT pay_subscription ON CONFLICT (whopMembershipId)
│    │  status: deactivated → 'canceled', else event status or 'active'
│    └─ upsert pay_customer (if userId)
│
├─ refund.*
│    ├─ lookup parent pay_payment via whopPaymentId
│    ├─ lookup parent payment's transaction for linking
│    ├─ UPSERT pay_refund ON CONFLICT (whopRefundId)
│    └─ INSERT pay_transaction (kind='refund', direction='outflow')
│       linked to parent payment tx via paymentTransactionId
│
├─ dispute.*
│    ├─ same parent lookup as refund
│    ├─ UPSERT pay_dispute ON CONFLICT (whopDisputeId)
│    │  tracks resolvedAt for won/lost/closed
│    └─ INSERT pay_transaction (kind='dispute', direction='outflow')
│
├─ invoice.*
│    ├─ lookup checkout session + subscription
│    ├─ UPSERT pay_invoice ON CONFLICT (whopInvoiceId)
│    └─ INSERT pay_transaction (kind='invoice')
│
├─ withdrawal.*
│    ├─ lookup pay_account via whopCompanyId
│    ├─ INSERT pay_transaction (kind='payout', direction='outflow')
│    └─ INSERT pay_transaction (kind='processor_fee')  ← only if fee > 0
│       sourceId = '{withdrawalId}:processor_fee'
│
├─ verification.*
│    ├─ lookup pay_account via whopCompanyId
│    └─ UPDATE pay_account metadata with verification status
│       (no ledger entry)
│
└─ unknown type → no handler matches, falls through silently
│
▼
╔══════════════════════════════════════════════════════════════════╗
║  8. FINALIZE                                                     ║
║     UPDATE pay_webhook_event                                     ║
║     SET status = 'processed', handledAt = now(), error = NULL    ║
║     WHERE id = :eventId                                          ║
║     COMMIT                                                       ║
╚══════════════════════════════════════════════════════════════════╝
│
├───────────────────────────┐
│ COMMIT succeeds           │ handler throws
│                           │
▼                           ▼
done                   TRANSACTION ROLLS BACK
                       (claim gate reverts — status back to pending/failed)
                       │
                       ▼
                  queue.ts catch block (outside txn):
                  UPDATE pay_webhook_event SET error = :message
                  re-throw → pg-boss marks job failed, schedules retry
                       │
                       ▼
                  ╔════════════════════════════════╗
                  ║  9. RETRY (pg-boss)            ║
                  ║     retryLimit: 5              ║
                  ║     retryBackoff: exponential  ║
                  ║     expireInSeconds: 600       ║
                  ╚════════════════════════════════╝
                       │
                  ┌────┼────┐
             retry ok    still fails after 5 retries
                  │         │
               back to      ▼
               step 5   ╔═══════════════════════════════════╗
                        ║  10. DEAD LETTER QUEUE             ║
                        ║      pg-boss moves to webhook.dead ║
                        ║      DLQ worker (polls every 30s): ║
                        ║      SET status = 'failed'         ║
                        ║      SET error = 'Exhausted all    ║
                        ║                   retries'         ║
                        ║      DLQ retention: 30 days        ║
                        ╚═══════════════════════════════════╝
                             │
                             ▼
                          permanent failure
                          (only path to status='failed')
```

## 1. Ingestion

**Route**: `apps/worker/src/routes/pay/index.ts` — `POST /webhooks/:processor`

### Signature verification

Composed from three headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`.

| Case                                        | Code      |
| ------------------------------------------- | --------- |
| `webhookSecret` not configured on server    | 500       |
| Missing `webhook-signature` header          | 400       |
| Missing `webhook-id` or `webhook-timestamp` | 400       |
| Timestamp outside 5-minute tolerance        | 401       |
| HMAC mismatch                               | 401       |
| Valid                                       | continues |

Verification uses constant-time comparison (XOR accumulation) to prevent timing attacks. Supports multiple signature versions (`v1,...`) space-separated in one header for forward-compatible secret rotation.

### Event parsing

Extracts entity IDs based on `type` prefix:

| Prefix         | Primary ID     | Secondary ID   |
| -------------- | -------------- | -------------- |
| `payment.*`    | `paymentId`    | —              |
| `membership.*` | `membershipId` | `paymentId`    |
| `refund.*`     | `refundId`     | `paymentId`    |
| `dispute.*`    | `disputeId`    | `paymentId`    |
| `invoice.*`    | `invoiceId`    | `membershipId` |
| `withdrawal.*` | `withdrawalId` | —              |

Amounts are normalized to minor units (cents) via `Math.round(value * 100)`.

### Deduplication

```sql
INSERT INTO pay_webhook_event (id, eventType, payload, status)
VALUES (:eventId, :eventType, :payload, 'pending')
ON CONFLICT (id) DO NOTHING
RETURNING id
```

The `id` is the Whop-assigned event ID (text primary key).

| Case                                                      | Response                            |
| --------------------------------------------------------- | ----------------------------------- |
| New event, insert succeeds                                | 202 — enqueued                      |
| Duplicate, existing status is `pending` or `failed`       | 202 — re-enqueued (retry)           |
| Duplicate, existing status is `processing` or `processed` | 200 — acknowledged, not re-enqueued |

### pg-boss enqueue

```ts
b.send('webhook.process', { eventId, eventType, event }, { singletonKey: eventId })
```

`singletonKey` provides a second dedup layer — pg-boss won't create a duplicate job if one with the same key is already active.

## 2. Processing

**Queue worker**: `apps/worker/src/lib/pay/queue.ts`
**Handlers**: `apps/worker/src/routes/pay/handlers.ts`

### Claim gate

First thing inside a PostgreSQL transaction:

```sql
UPDATE pay_webhook_event
SET status = 'processing'
WHERE id = :eventId AND status IN ('pending', 'failed')
RETURNING id
```

If `claimed` is null, the function returns early — no work done.

**Why this works under concurrency**: PostgreSQL `UPDATE` acquires a row-level exclusive lock. When two workers race:

1. Worker A locks the row, sets `status = 'processing'`, continues
2. Worker B blocks on the row lock, waits
3. Worker A commits (or the transaction continues)
4. Worker B unblocks, PostgreSQL **re-evaluates** the `WHERE` clause (EvalPlanQual recheck under Read Committed)
5. `status` is now `'processing'` — not in `('pending', 'failed')` — the `WHERE` no longer matches
6. Worker B gets no rows back, skips

Only one worker ever processes a given event.

### Advisory locks

After claiming, acquires a transaction-scoped advisory lock on the entity:

```sql
SELECT pg_advisory_xact_lock(hashtext(:lockKey))
```

| Event type       | Lock key                    | Effect                                       |
| ---------------- | --------------------------- | -------------------------------------------- |
| `payment.*`      | `payment:{paymentId}`       | Serializes all events for same payment       |
| `membership.*`   | `membership:{membershipId}` | Serializes all events for same subscription  |
| `refund.*`       | `payment:{paymentId}`       | Serializes with parent payment's events      |
| `dispute.*`      | `payment:{paymentId}`       | Serializes with parent payment's events      |
| `invoice.*`      | `membership:{membershipId}` | Serializes with parent subscription's events |
| `withdrawal.*`   | `withdrawal:{withdrawalId}` | Per-withdrawal                               |
| `verification.*` | `company:{companyId}`       | Per-company                                  |

This prevents out-of-order processing — e.g., `payment.succeeded` and `refund.created` for the same payment can't run concurrently even if they have different event IDs.

### Event dispatch

Routes to one of 7 handlers based on `eventType.startsWith(...)`:

- `payment.*` → `upsertPaymentFromWebhook`
- `membership.*` → `upsertMembershipFromWebhook`
- `refund.*` → `upsertRefundFromWebhook`
- `dispute.*` → `upsertDisputeFromWebhook`
- `invoice.*` → `upsertInvoiceFromWebhook`
- `withdrawal.*` → `upsertWithdrawalFromWebhook`
- `verification.*` → `handleVerificationWebhook`

Unrecognized event types pass through silently — marked `processed` at the end. No error, no retry.

### Entity upserts

Every handler uses `INSERT ... ON CONFLICT ... DO UPDATE SET`:

| Entity             | Conflict column           | Notes                                               |
| ------------------ | ------------------------- | --------------------------------------------------- |
| `pay_payment`      | `whopPaymentId`           | Also upserts checkout status on `payment.succeeded` |
| `pay_subscription` | `whopMembershipId`        | Status derived from event type                      |
| `pay_refund`       | `whopRefundId`            | Links to parent payment                             |
| `pay_dispute`      | `whopDisputeId`           | Links to parent payment                             |
| `pay_invoice`      | `whopInvoiceId`           | Links to subscription and checkout                  |
| `pay_transaction`  | `(kind, sourceId)`        | Ledger entries, see below                           |
| `pay_customer`     | `(projectId, externalId)` | Updates email/name only if non-null                 |

All upserts update every field except `createdAt`. Receiving the same webhook twice produces the same final state — fully idempotent.

### Transaction ledger

`payment.succeeded` creates up to 2 transaction records:

1. **payment** — `sourceId = paymentId`
2. **processor_fee** — `sourceId = {paymentId}:processor_fee` (only if fee > 0)

`withdrawal.*` creates up to 2:

1. **payout** — `sourceId = withdrawalId`
2. **processor_fee** — `sourceId = {withdrawalId}:processor_fee` (only if fee > 0)

`sourceId` is deterministic, so the `(kind, sourceId)` unique index makes retries safe.

Each transaction has a `direction`: `inflow` (payment, refund_reversal, dispute_reversal), `outflow` (refund, dispute, processor_fee, payout), or `neutral`.

### Project resolution

Handlers resolve `projectId` in priority order:

1. `session_id` in metadata → look up `pay_checkout_session.projectId`
2. `project_id` in metadata → direct
3. Parent entity (e.g., refund → payment → projectId)
4. `null` if nothing found

### On success

```sql
UPDATE pay_webhook_event
SET status = 'processed', handledAt = now(), error = NULL
WHERE id = :eventId
```

This happens inside the same transaction as the claim and entity upserts — atomic commit.

### On failure

The transaction rolls back (claim gate revert — status returns to what it was before: `pending` or `failed`). Then outside the transaction:

```sql
UPDATE pay_webhook_event SET error = :message WHERE id = :eventId
```

The error is thrown to pg-boss, which schedules a retry.

## 3. Retry and DLQ

### Queue configuration

| Setting            | Value                    |
| ------------------ | ------------------------ |
| `retryLimit`       | 5                        |
| `retryBackoff`     | true (exponential)       |
| `expireInSeconds`  | 600 (10 min per attempt) |
| `retentionSeconds` | 604800 (7 days)          |
| `deadLetter`       | `webhook.dead`           |

### DLQ worker

Polls every 30 seconds. For each dead job:

```sql
UPDATE pay_webhook_event
SET status = 'failed', handledAt = now(), error = 'Exhausted all retries'
WHERE id = :eventId
```

This is the **only** path that permanently marks an event as `failed`. DLQ retention is 30 days.

## 4. Event lifecycle

```
pending → processing → processed     (happy path)
pending → processing → [txn rollback] → pending → retry...
pending → processing → [txn rollback] → pending → ... → DLQ → failed
```

Status transitions:

| From         | To                 | Where                                               |
| ------------ | ------------------ | --------------------------------------------------- |
| —            | `pending`          | Webhook ingestion (INSERT)                          |
| `pending`    | `processing`       | Claim gate (inside txn)                             |
| `failed`     | `processing`       | Claim gate retry (inside txn)                       |
| `processing` | `processed`        | Handler success (inside txn, commits)               |
| `processing` | `pending`/`failed` | Handler failure (txn rolls back to pre-claim state) |
| `pending`    | `failed`           | DLQ worker (permanent, after 5 retries)             |

## 5. Deduplication summary

Three layers prevent double-processing:

1. **Webhook event table** — `INSERT ON CONFLICT(id) DO NOTHING` on Whop event ID
2. **pg-boss singletonKey** — prevents duplicate jobs in the queue
3. **Claim gate** — `UPDATE WHERE status IN ('pending', 'failed')` with row-level locking

And entity upserts (`ON CONFLICT DO UPDATE`) ensure that even if processing somehow runs twice, the final state is identical.

## 6. Shutdown

```ts
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

`stopBoss({ graceful: true, timeout: 10_000 })` — waits up to 10 seconds for in-flight jobs to finish. Abandoned jobs are re-queued by pg-boss on next startup.

## 7. Checkout Idempotency

The other core async flow. `POST /checkout` uses a reserve-first pattern to prevent double charges.

```
Request with idempotencyKey
         │
         ▼
  SELECT existing row WHERE (projectId, idempotencyKey)
         │
    ┌────┼────┐────────────┐
  not found  status=open/   status=failed
    │        completed/     or creating >60s (stale)
    │        creating(<60s)    │
    │           │           DELETE row
    │        return it         │
    │        (no Whop call)    │
    ▼                          ▼
  INSERT status='creating', whopCheckoutId=NULL
  ON CONFLICT (projectId, idempotencyKey) DO NOTHING
         │
    ┌────┼────┐
  insert ok  conflict (another request won the race)
    │              │
    │        SELECT winner's row, return it
    ▼
  Call Whop API
    │
  ┌─┼─┐
  ok  error
  │     │
  │   UPDATE status='failed', re-throw
  ▼
  UPDATE status='open', set whopCheckoutId + purchaseUrl
  return { id, sessionId, purchaseUrl, status }
```

**Tenant isolation**: unique index is `(projectId, idempotencyKey)`, not just `idempotencyKey`. Different projects can reuse the same key.

**No idempotency key**: `idempotencyKey` is set to `NULL`. SQL unique indexes ignore NULLs (`NULL != NULL`), so every request creates a new checkout.

**Race between delete and insert**: Two requests both see a stale row, both delete, both try to insert. `ON CONFLICT DO NOTHING` ensures exactly one wins. The loser reads the winner's row.

## 8. Entity Handler Details

### payment.\*

1. Look up checkout session via `session_id` in metadata
2. Upsert `pay_payment` (ON CONFLICT `whopPaymentId`)
3. Upsert `pay_customer` if userId or email present
4. On `payment.succeeded`:
   - Create `payment` transaction in ledger
   - Create `processor_fee` transaction if fee > 0 (sourceId: `{paymentId}:processor_fee`)
   - Update checkout session status to `completed`

### membership.\*

1. Look up checkout session via `session_id` in metadata
2. Upsert `pay_subscription` (ON CONFLICT `whopMembershipId`)
3. Status: `membership.deactivated` → `canceled`, everything else → event's status or `active`
4. Upsert `pay_customer` if userId present

### refund.\*

1. Look up parent `pay_payment` via `whopPaymentId`
2. Look up parent payment's transaction for linking
3. Upsert `pay_refund` (ON CONFLICT `whopRefundId`)
4. Create `refund` transaction in ledger (direction: `outflow`, linked to parent payment tx)

### dispute.\*

1. Same parent lookup chain as refund
2. Upsert `pay_dispute` (ON CONFLICT `whopDisputeId`)
3. Create `dispute` transaction in ledger (direction: `outflow`)
4. Tracks resolved status (`won`/`lost`/`closed` → sets `resolvedAt`)

### invoice.\*

1. Look up checkout session AND subscription (via `session_id` and `membershipId`)
2. Upsert `pay_invoice` (ON CONFLICT `whopInvoiceId`)
3. Create `invoice` transaction in ledger
4. Links to subscription if available

### withdrawal.\*

1. Look up `pay_account` via `whopCompanyId`
2. Create `payout` transaction in ledger
3. Create `processor_fee` transaction if fee > 0 (sourceId: `{withdrawalId}:processor_fee`)

### verification.\*

1. Look up `pay_account` via `whopCompanyId`
2. Update account's metadata with verification status (`succeeded`/`failed`) and raw data
3. No transaction ledger entry

## 9. Out-of-Order Events

What happens when events arrive in unexpected order:

| Scenario                                               | Behavior                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refund.created` arrives before `payment.succeeded`    | Refund handler looks up `pay_payment` by `whopPaymentId` — if payment row doesn't exist yet, `payment` is null. Refund is still created with `projectId = null`. When payment event arrives later, it creates the payment row. The refund keeps its null projectId (no backfill). |
| `payment.succeeded` arrives twice                      | Second delivery hits `ON CONFLICT DO NOTHING` at ingestion. Even if it bypasses that, the claim gate prevents re-processing. Even if it bypasses _that_, the upsert produces identical final state.                                                                               |
| `membership.deactivated` before `membership.activated` | Advisory lock on `membership:{id}` serializes them. If deactivated processes first, subscription is created as canceled. When activated processes, it upserts to active. Correct final state regardless of order.                                                                 |
| Unknown event type (e.g., `foo.bar`)                   | Passes through all handlers (no `startsWith` match), marked `processed`. No error, no retry, no data written.                                                                                                                                                                     |

## 10. Database Schema

### Tables

| Table                  | PK                   | Purpose                                   |
| ---------------------- | -------------------- | ----------------------------------------- |
| `pay_account`          | uuid                 | Whop company connections per project+user |
| `pay_checkout_session` | uuid                 | Checkout lifecycle tracking               |
| `pay_webhook_event`    | text (Whop event ID) | Webhook dedup + status tracking           |
| `pay_payment`          | uuid                 | Payment records from webhooks             |
| `pay_subscription`     | uuid                 | Subscription/membership records           |
| `pay_invoice`          | uuid                 | Invoice records                           |
| `pay_refund`           | uuid                 | Refund records                            |
| `pay_dispute`          | uuid                 | Dispute/chargeback records                |
| `pay_transaction`      | uuid                 | Unified ledger (all money movement)       |
| `pay_customer`         | uuid                 | Denormalized customer records             |

### Key Indexes

| Index                                        | Type   | Purpose                              |
| -------------------------------------------- | ------ | ------------------------------------ |
| `pay_account (projectId, userId)`            | unique | One account per user per project     |
| `pay_account (whopCompanyId)`                | unique | One row per Whop company             |
| `pay_checkout (projectId, idempotencyKey)`   | unique | Checkout idempotency (tenant-scoped) |
| `pay_checkout (whopCheckoutId)`              | unique | Maps Whop checkout to local row      |
| `pay_webhook_event (status, receivedAt)`     | btree  | Efficient polling for pending events |
| `pay_payment (whopPaymentId)`                | unique | Upsert conflict target               |
| `pay_payment (metadata)`                     | GIN    | Fast customer lookups via jsonb      |
| `pay_subscription (whopMembershipId)`        | unique | Upsert conflict target               |
| `pay_subscription (whopUserId)`              | btree  | Customer subscription lookups        |
| `pay_transaction (kind, sourceId)`           | unique | Ledger upsert conflict target        |
| `pay_transaction (paymentTransactionId)`     | btree  | Fee → payment tx linking             |
| `pay_customer (projectId, externalId)`       | unique | Upsert conflict target               |
| `product (projectId, productGroup, version)` | unique | One version per product group        |

### Foreign keys with cascade

All `projectId` references use either `ON DELETE CASCADE` (account, customer) or `ON DELETE SET NULL` (payment, subscription, invoice, etc). Deleting a project cleans up accounts and customers, nullifies projectId on financial records (preserving history).

## 11. File Map

```
apps/worker/src/
├── index.ts                          Server startup, pg-boss init, shutdown handlers
├── lib/
│   ├── config.ts                     Whop config (apiKey, platformCompanyId, webhookSecret)
│   └── pay/
│       ├── types.ts                  Whop API types, ParsedWhopWebhookEvent
│       ├── client.ts                 PayClient — HTTP wrapper for Whop API
│       ├── webhooks.ts              Signature verification, event parsing
│       └── queue.ts                  pg-boss setup, webhook.process + webhook.dead workers
├── routes/pay/
│   ├── index.ts                      All 28 Hono routes (REST API)
│   ├── handlers.ts                   Webhook event processing + entity upsert handlers
│   ├── auth.ts                       Session + API key auth, project scope resolution
│   ├── utils.ts                      Shared helpers (hashApiKey, getProductsWithPrices, etc)
│   ├── schemas.ts                    Zod validation schemas for all routes
│   └── mappers.ts                    Legacy response format mappers
├── apis/pay.ts                       MCP API functions (listProducts, listCustomers, etc)
├── mcp/pay.ts                        MCP server with list_products tool
packages/db/src/
├── migrations/018_pay.ts             All pay_* table definitions and indexes
└── types.ts                          TypeScript types for all tables
```
