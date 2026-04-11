# Cloudflare Multi-Tenant Platform: Comprehensive Research Report

> Research date: April 4, 2026
> Covers every Cloudflare primitive relevant to building a multi-tenant platform where each user/tenant gets isolated infrastructure.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Workers for Platforms (The Foundation)](#2-workers-for-platforms)
3. [D1 (Per-Tenant SQLite Databases)](#3-d1-per-tenant-databases)
4. [Durable Objects (Stateful Compute)](#4-durable-objects)
5. [Workers KV (Key-Value Storage)](#5-workers-kv)
6. [R2 (Object Storage)](#6-r2-object-storage)
7. [Service Bindings (Worker-to-Worker RPC)](#7-service-bindings)
8. [Hyperdrive (External DB Connection Pooling)](#8-hyperdrive)
9. [Queues (Async Message Passing)](#9-queues)
10. [Workers AI (Edge AI Inference)](#10-workers-ai)
11. [Vectorize (Vector Database)](#11-vectorize)
12. [Pages (Static Site Hosting)](#12-pages)
13. [Rate Limiting](#13-rate-limiting)
14. [Complete Pricing Reference](#14-complete-pricing-reference)
15. [Multi-Tenant Architecture Patterns](#15-multi-tenant-architecture-patterns)
16. [Full Platform Blueprint with Code](#16-full-platform-blueprint)

---

## 1. Architecture Overview

The core idea: You (the platform) own a single Cloudflare account. Using **Workers for Platforms**, you programmatically deploy isolated Workers for each tenant. Each tenant's Worker gets its own bindings to D1, KV, R2, Durable Objects, etc. -- all provisioned via the Cloudflare REST API.

```
                   Incoming Request
                        |
                   [Your Domain]
                        |
               +--------v--------+
               | Dispatch Worker |  (Your routing logic)
               | - Auth check    |
               | - Tenant lookup |
               | - Rate limiting |
               +--------+--------+
                        |
            env.DISPATCHER.get(tenantName)
                        |
          +-------------v--------------+
          |     Dispatch Namespace      |
          |  (Contains ALL tenant       |
          |   Workers)                  |
          |                            |
          |  +-------+ +-------+      |
          |  |Tenant | |Tenant |      |
          |  |  A's  | |  B's  | ... |
          |  |Worker | |Worker |      |
          |  +---+---+ +---+---+      |
          +------|---------|----------+
                 |         |
         +-------v---+ +--v--------+
         |Tenant A's | |Tenant B's |
         | Bindings: | | Bindings: |
         | - D1 DB   | | - D1 DB   |
         | - KV NS   | | - KV NS   |
         | - R2 Bucket| | - R2 Bucket|
         | - DO       | | - DO       |
         +-----------+ +-----------+
                 |         |
          +------v---------v------+
          |   Outbound Worker     |  (Optional)
          |   - Egress control    |
          |   - API auth inject   |
          |   - Request logging   |
          +------------------------+
```

---

## 2. Workers for Platforms

**This is THE key product.** Workers for Platforms lets you create "dispatch namespaces" where you deploy user Workers programmatically. Each user gets their own isolated Worker runtime.

### 2.1 Core Concepts

| Component              | Purpose                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Dispatch Namespace** | Container holding all tenant Workers. Think of it as a "namespace" or "pool" of user scripts.                     |
| **Dispatch Worker**    | YOUR Worker that receives all incoming requests, does auth/routing, then dispatches to the correct tenant Worker. |
| **User Worker**        | The tenant's Worker code, deployed into the dispatch namespace. Runs in untrusted mode with full isolation.       |
| **Outbound Worker**    | Optional interceptor for all `fetch()` calls made by user Workers (egress control, logging, auth injection).      |

### 2.2 Security Isolation

- Each user Worker runs in **untrusted mode**
- User Workers **never share cache** even on the same zone
- User Workers **cannot access `request.cf`** object (unless trusted mode is enabled)
- `caches.default` is **disabled** for namespaced scripts
- Complete code and data isolation between tenants

### 2.3 API: Create a Dispatch Namespace

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/dispatch/namespaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{"name": "production"}'
```

Response:

```json
{
  "success": true,
  "result": {
    "namespace_id": "uuid-here",
    "namespace_name": "production",
    "script_count": 0,
    "trusted_workers": false
  }
}
```

### 2.4 API: Deploy a User Worker to Namespace

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/dispatch/namespaces/production/scripts/tenant-abc" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F 'metadata={"main_module":"worker.js","bindings":[{"type":"kv_namespace","name":"KV","namespace_id":"kv-ns-id-here"},{"type":"d1","name":"DB","id":"d1-db-id-here"},{"type":"r2_bucket","name":"BUCKET","bucket_name":"tenant-abc-bucket"}]}' \
  -F 'worker.js=@worker.js;type=application/javascript+module'
```

Key points about the metadata:

- `main_module`: The entry point file name
- `bindings`: Array of binding objects, each with a `type`, `name`, and resource-specific ID
- `keep_bindings`: Pass `["kv_namespace", "r2_bucket"]` to preserve existing bindings when updating

### 2.5 Dispatch Worker (Routing Logic)

**wrangler.jsonc:**

```jsonc
{
  "name": "dispatch-worker",
  "main": "src/index.ts",
  "dispatch_namespaces": [
    {
      "binding": "DISPATCHER",
      "namespace": "production",
    },
  ],
}
```

**src/index.ts -- Subdomain-based routing:**

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Extract tenant from subdomain: tenant-abc.yourplatform.com
    const hostname = url.hostname
    const tenantSlug = hostname.split('.')[0]

    // Or look up tenant from a KV mapping
    // const tenantSlug = await env.TENANT_MAP.get(hostname);

    if (!tenantSlug) {
      return new Response('Tenant not found', { status: 404 })
    }

    try {
      // Get the tenant's Worker from the dispatch namespace
      const userWorker = env.DISPATCHER.get(
        tenantSlug,
        {},
        {
          limits: {
            cpuMs: 50, // 50ms CPU time limit
            subRequests: 10, // Max 10 outbound requests
          },
        },
      )

      // Forward the request to the tenant's Worker
      return userWorker.fetch(request)
    } catch (e) {
      if (e.message.includes('Worker not found')) {
        return new Response('App not found', { status: 404 })
      }
      return new Response('Internal error', { status: 500 })
    }
  },
}
```

**Path-based routing alternative:**

```typescript
// example.com/tenant-abc/api/users
const tenantSlug = url.pathname.split('/')[1]
const userWorker = env.DISPATCHER.get(tenantSlug)
return userWorker.fetch(request)
```

**KV-based hostname routing (for custom domains):**

```typescript
// Look up which tenant owns this custom domain
const tenantSlug = await env.DOMAIN_MAP.get(url.hostname)
if (!tenantSlug) return new Response('Not found', { status: 404 })
const userWorker = env.DISPATCHER.get(tenantSlug)
return userWorker.fetch(request)
```

### 2.6 Custom Limits per Tenant

```typescript
// Free tier tenant
const freeWorker = env.DISPATCHER.get(
  tenantSlug,
  {},
  {
    limits: { cpuMs: 10, subRequests: 5 },
  },
)

// Pro tier tenant
const proWorker = env.DISPATCHER.get(
  tenantSlug,
  {},
  {
    limits: { cpuMs: 50, subRequests: 50 },
  },
)

// Enterprise tenant (no custom limits -- uses account defaults)
const enterpriseWorker = env.DISPATCHER.get(tenantSlug)
```

When limits are exceeded, the user Worker throws an exception that propagates to your dispatch Worker.

### 2.7 Outbound Workers (Egress Control)

**wrangler.jsonc:**

```jsonc
{
  "dispatch_namespaces": [
    {
      "binding": "DISPATCHER",
      "namespace": "production",
      "outbound": {
        "service": "outbound-worker",
        "parameters": ["tenantId", "planType"],
      },
    },
  ],
}
```

**outbound-worker.ts:**

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tenantId = env.tenantId
    const planType = env.planType

    // Log all outgoing requests
    console.log(`Tenant ${tenantId} calling: ${request.url}`)

    // Block certain domains
    const blocklist = ['evil.com', 'malware.org']
    const hostname = new URL(request.url).hostname
    if (blocklist.includes(hostname)) {
      return new Response('Blocked', { status: 403 })
    }

    // Inject auth for your own APIs
    if (hostname === 'api.yourplatform.com') {
      const headers = new Headers(request.headers)
      headers.set('Authorization', `Bearer ${env.PLATFORM_API_KEY}`)
      return fetch(new Request(request, { headers }))
    }

    return fetch(request)
  },
}
```

### 2.8 Workers for Platforms Limits

| Limit                  | Value                          |
| ---------------------- | ------------------------------ |
| Scripts per namespace  | **Unlimited**                  |
| Namespaces per account | No documented limit            |
| Tags per script        | 8                              |
| API rate limit         | 1,200 requests per 5 minutes   |
| Deployment             | Immediate (no gradual rollout) |

### 2.9 Workers for Platforms Pricing

| Resource  | Included      | Overage                 |
| --------- | ------------- | ----------------------- |
| Base cost | **$25/month** | -                       |
| Requests  | 20M/month     | $0.30/million           |
| CPU time  | 60M ms/month  | $0.02/million ms        |
| Scripts   | 1,000         | $0.02/additional script |

**Important:** Only 1 request is charged across the entire dispatch -> user -> outbound Worker chain. CPU time is charged across all three.

---

## 3. D1 (Per-Tenant Databases)

D1 is Cloudflare's serverless SQLite database. It is **explicitly designed for multi-tenant patterns** with per-tenant database isolation.

### 3.1 Why D1 for Multi-Tenancy

- Designed for "horizontal scale out across multiple, smaller (10 GB) databases, such as per-user, per-tenant or per-entity databases"
- Up to **50,000 databases per account** (paid plan)
- Each database is an isolated SQLite instance
- No additional isolation costs
- Time Travel: restore any database to any minute within the last 30 days

### 3.2 API: Create a Database per Tenant

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{
    "name": "tenant-abc-db",
    "primary_location_hint": "wnam"
  }'
```

Response:

```json
{
  "success": true,
  "result": {
    "uuid": "d1-database-uuid",
    "name": "tenant-abc-db",
    "created_at": "2026-04-04T...",
    "version": "production"
  }
}
```

### 3.3 API: Run Migrations on a Tenant Database

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{
    "sql": "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, created_at TEXT DEFAULT (datetime(\"now\"))); CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, content TEXT, created_at TEXT DEFAULT (datetime(\"now\")));"
  }'
```

### 3.4 Querying D1 from a Worker

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Prepared statement (safe from SQL injection)
    const result = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind('user@example.com')
      .run()

    return Response.json(result.results)
  },
}
```

**Batch queries (atomic):**

```typescript
const results = await env.DB.batch([
  env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind('1', 'a@b.com'),
  env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind('2', 'c@d.com'),
])
```

**TypeScript support:**

```typescript
type User = { id: string; email: string; name: string }
const result = await env.DB.prepare('SELECT * FROM users').run<User>()
// result.results is User[]
```

### 3.5 Running Migrations Across All Tenant Databases

```typescript
// Platform admin Worker or script
async function migrateAllTenants(env: Env, migration: string) {
  // Get all tenant database IDs from your platform DB
  const tenants = await env.PLATFORM_DB.prepare('SELECT d1_database_id FROM tenants').all()

  // Run migration on each tenant DB via REST API
  for (const tenant of tenants.results) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${tenant.d1_database_id}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: migration }),
      },
    )
  }
}
```

### 3.6 D1 Limits

| Limit                         | Free       | Paid       |
| ----------------------------- | ---------- | ---------- |
| Databases per account         | 10         | **50,000** |
| Max database size             | 500 MB     | **10 GB**  |
| Max storage per account       | 5 GB       | **1 TB**   |
| Queries per Worker invocation | 50         | 1,000      |
| Max SQL statement             | 100 KB     | 100 KB     |
| Max query duration            | 30 seconds | 30 seconds |
| Max columns per table         | 100        | 100        |
| Max row size                  | 2 MB       | 2 MB       |
| Time Travel                   | 7 days     | 30 days    |

### 3.7 D1 Pricing

| Resource     | Free     | Paid (included) | Overage        |
| ------------ | -------- | --------------- | -------------- |
| Rows read    | 5M/day   | 25B/month       | $0.001/million |
| Rows written | 100K/day | 50M/month       | $1.00/million  |
| Storage      | 5 GB     | 5 GB            | $0.75/GB-month |

---

## 4. Durable Objects (Stateful Compute)

Durable Objects combine compute + storage in a single globally-unique object. Each has its own private SQLite database.

### 4.1 Why Durable Objects for Multi-Tenancy

- Each Durable Object instance has a **globally unique ID** or name
- Built-in **private SQLite database** per object
- **Strong consistency** -- reads always see latest writes
- Perfect for: real-time collaboration, WebSocket state, per-tenant config, rate limiting, sessions
- Can namespace by tenant: `env.MY_DO.idFromName("tenant-abc")`

### 4.2 Durable Object Class with SQLite

```typescript
import { DurableObject } from 'cloudflare:workers'

export class TenantState extends DurableObject {
  async initialize() {
    // Create tables in this DO's private SQLite DB
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        data TEXT,
        expires_at INTEGER
      );
    `)
  }

  async getConfig(key: string): Promise<string | null> {
    const row = this.ctx.storage.sql.exec('SELECT value FROM config WHERE key = ?', key).one()
    return row?.value ?? null
  }

  async setConfig(key: string, value: string): Promise<void> {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      key,
      value,
    )
  }

  // WebSocket handling for real-time features
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      this.ctx.acceptWebSocket(pair[1])
      return new Response(null, { status: 101, webSocket: pair[0] })
    }
    return new Response('OK')
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Handle real-time messages per tenant
    const data = JSON.parse(message)
    // Broadcast to all connected clients of this tenant
    for (const client of this.ctx.getWebSockets()) {
      if (client !== ws) {
        client.send(message)
      }
    }
  }
}
```

### 4.3 Accessing Durable Objects from Workers

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tenantId = 'tenant-abc'

    // Get a stub for this tenant's Durable Object
    const id = env.TENANT_STATE.idFromName(tenantId)
    const stub = env.TENANT_STATE.get(id)

    // Call methods via RPC (no HTTP overhead)
    const config = await stub.getConfig('theme')

    return Response.json({ theme: config })
  },
}
```

### 4.4 Storage API

**SQL API (recommended for new implementations):**

```typescript
// Execute queries
const cursor = this.ctx.storage.sql.exec('SELECT * FROM users WHERE active = ?', 1)

// Iterate results
for (const row of cursor) {
  console.log(row.name, row.email)
}

// Get single result
const count = this.ctx.storage.sql.exec('SELECT COUNT(*) as cnt FROM users').one()

// Get all as array
const all = cursor.toArray()

// Database size
const bytes = this.ctx.storage.sql.databaseSize
```

**Transactional operations:**

```typescript
this.ctx.storage.transactionSync(() => {
  this.ctx.storage.sql.exec('INSERT INTO ledger VALUES (?, ?)', id, amount)
  this.ctx.storage.sql.exec(
    'UPDATE balance SET amount = amount + ? WHERE tenant = ?',
    amount,
    tenantId,
  )
})
```

**Key-Value API (synchronous, for SQLite-backed):**

```typescript
this.ctx.storage.kv.put('session:abc', { userId: '123', role: 'admin' })
const session = this.ctx.storage.kv.get('session:abc')
this.ctx.storage.kv.delete('session:abc')

// List with prefix
for (const [key, value] of this.ctx.storage.kv.list({ prefix: 'session:' })) {
  console.log(key, value)
}
```

**Alarms (scheduled future execution):**

```typescript
// Set an alarm for 1 hour from now
await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);

// Handle the alarm
async alarm() {
  // Clean up expired sessions, send notifications, etc.
  this.ctx.storage.sql.exec("DELETE FROM sessions WHERE expires_at < ?", Date.now());
}
```

**Point-in-Time Recovery:**

```typescript
// Restore to 2 days ago
const bookmark = await this.ctx.storage.getBookmarkForTime(Date.now() - 2 * 24 * 60 * 60 * 1000)
await this.ctx.storage.onNextSessionRestoreBookmark(bookmark)
this.ctx.abort() // Restart to apply
```

### 4.5 Durable Objects Pricing

| Resource           | Free         | Paid (included) | Overage             |
| ------------------ | ------------ | --------------- | ------------------- |
| Requests           | 100K/day     | 1M/month        | $0.15/million       |
| Duration           | 13K GB-s/day | 400K GB-s/month | $12.50/million GB-s |
| **SQLite Storage** |              |                 |                     |
| Rows read          | 5M/day       | 25B/month       | $0.001/million      |
| Rows written       | 100K/day     | 50M/month       | $1.00/million       |
| Data storage       | 5 GB         | 5 GB            | $0.20/GB-month      |

WebSocket messages have a 20:1 billing ratio (100 messages = 5 billable requests).

---

## 5. Workers KV (Key-Value Storage)

Globally distributed, eventually-consistent key-value store. Best for read-heavy workloads.

### 5.1 Multi-Tenant Pattern

Two approaches:

1. **Separate namespace per tenant** -- Better isolation, manage via API
2. **Shared namespace with key prefixes** -- Simpler, prefix keys with `tenant:{id}:`

### 5.2 API: Create a KV Namespace per Tenant

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{"title": "tenant-abc-kv"}'
```

Response:

```json
{
  "success": true,
  "result": {
    "id": "0f2ac74b498b48028cb68387c421e279",
    "title": "tenant-abc-kv"
  }
}
```

### 5.3 Using KV from Workers

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Write
    await env.KV.put('user:123', JSON.stringify({ name: 'John' }))

    // Read
    const user = await env.KV.get('user:123', 'json')

    // Write with expiration (TTL in seconds)
    await env.KV.put('session:abc', 'data', { expirationTtl: 3600 })

    // List keys with prefix
    const list = await env.KV.list({ prefix: 'user:' })

    // Delete
    await env.KV.delete('user:123')

    return Response.json(user)
  },
}
```

### 5.4 KV Pricing

| Resource        | Free     | Paid (included) | Overage        |
| --------------- | -------- | --------------- | -------------- |
| Reads           | 100K/day | 10M/month       | $0.50/million  |
| Writes          | 1K/day   | 1M/month        | $5.00/million  |
| Deletes         | 1K/day   | 1M/month        | $5.00/million  |
| List operations | 1K/day   | 1M/month        | $5.00/million  |
| Storage         | 1 GB     | 1 GB            | $0.50/GB-month |

---

## 6. R2 (Object Storage)

S3-compatible object storage with **zero egress fees**. Perfect for per-tenant file storage.

### 6.1 Multi-Tenant Patterns

Two approaches:

1. **Separate bucket per tenant** -- Up to 1,000,000 buckets per account
2. **Shared bucket with key prefixes** -- `tenant-abc/uploads/photo.jpg`

### 6.2 API: Create an R2 Bucket per Tenant

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/r2/buckets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{"name": "tenant-abc-assets", "locationHint": "wnam"}'
```

### 6.3 Using R2 from Workers

**wrangler.jsonc:**

```jsonc
{
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "tenant-abc-assets",
    },
  ],
}
```

**Worker code:**

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const key = url.pathname.slice(1) // Remove leading /

    switch (request.method) {
      case 'PUT': {
        await env.BUCKET.put(key, request.body, {
          httpMetadata: {
            contentType: request.headers.get('content-type') || 'application/octet-stream',
          },
        })
        return new Response('Uploaded', { status: 200 })
      }

      case 'GET': {
        const object = await env.BUCKET.get(key)
        if (!object) return new Response('Not Found', { status: 404 })

        return new Response(object.body, {
          headers: {
            'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
            etag: object.httpEtag,
          },
        })
      }

      case 'DELETE': {
        await env.BUCKET.delete(key)
        return new Response('Deleted', { status: 200 })
      }

      default:
        return new Response('Method not allowed', { status: 405 })
    }
  },
}
```

### 6.4 Presigned URLs (Direct Client Upload/Download)

Generate presigned URLs server-side so clients can upload/download directly to R2 without going through your Worker:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// Generate upload URL (valid for 1 hour)
const uploadUrl = await getSignedUrl(
  s3,
  new PutObjectCommand({
    Bucket: 'tenant-abc-assets',
    Key: 'uploads/photo.jpg',
    ContentType: 'image/jpeg',
  }),
  { expiresIn: 3600 },
)

// Generate download URL
const downloadUrl = await getSignedUrl(
  s3,
  new GetObjectCommand({
    Bucket: 'tenant-abc-assets',
    Key: 'uploads/photo.jpg',
  }),
  { expiresIn: 3600 },
)
```

Presigned URL constraints:

- Max expiration: 7 days (604,800 seconds)
- Supports GET, PUT, HEAD, DELETE operations
- Cannot be used with custom domains (use `{account_id}.r2.cloudflarestorage.com`)
- Generated client-side using AWS Signature v4

### 6.5 R2 Pricing

| Resource             | Free        | Paid            |
| -------------------- | ----------- | --------------- |
| Storage              | 10 GB/month | $0.015/GB-month |
| Class A ops (writes) | 1M/month    | $4.50/million   |
| Class B ops (reads)  | 10M/month   | $0.36/million   |
| **Egress**           | **Free**    | **Free**        |

### 6.6 R2 Limits

| Limit                       | Value            |
| --------------------------- | ---------------- |
| Buckets per account         | 1,000,000        |
| Object size (single upload) | 5 GiB            |
| Object size (multipart)     | ~5 TiB           |
| Objects per bucket          | Unlimited        |
| Storage per bucket          | Unlimited        |
| Object key length           | 1,024 bytes      |
| Metadata per object         | 8,192 bytes      |
| Bucket management ops       | 50/second/bucket |

---

## 7. Service Bindings (Worker-to-Worker RPC)

Service bindings allow Workers to call other Workers directly without HTTP overhead. Both Workers run on the same thread by default.

### 7.1 RPC Pattern (Recommended)

**Shared service Worker:**

```typescript
import { WorkerEntrypoint } from 'cloudflare:workers'

export class AuthService extends WorkerEntrypoint {
  async verifyToken(token: string): Promise<{ userId: string; tenantId: string }> {
    // Auth logic here
    return { userId: 'user-123', tenantId: 'tenant-abc' }
  }

  async createToken(userId: string): Promise<string> {
    // Token creation logic
    return 'jwt-token-here'
  }
}
```

**Calling Worker:**

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')

    // Direct RPC call -- no HTTP overhead, same thread
    const auth = await env.AUTH_SERVICE.verifyToken(token)

    return Response.json({ user: auth.userId, tenant: auth.tenantId })
  },
}
```

**wrangler.jsonc:**

```jsonc
{
  "services": [
    {
      "binding": "AUTH_SERVICE",
      "service": "auth-worker",
    },
  ],
}
```

### 7.2 Key Characteristics

- **Zero latency** -- both Workers run on the same thread
- **No additional cost** for the binding call
- **32 Worker invocation limit** per single request chain
- Perfect for microservice architecture on Cloudflare

---

## 8. Hyperdrive (External DB Connection Pooling)

Hyperdrive makes external PostgreSQL/MySQL databases feel fast from Workers by maintaining connection pools at the edge and caching queries.

### 8.1 Supported Databases

- PostgreSQL (and compatible: CockroachDB, Neon, Supabase, Timescale)
- MySQL (and compatible: PlanetScale)

### 8.2 Configuration

```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "your-hyperdrive-config-id",
      "localConnectionString": "postgresql://user:pass@localhost:5432/mydb",
    },
  ],
}
```

**Worker code:**

```typescript
import { Client } from 'pg'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Hyperdrive provides a connection string with pooling built in
    const client = new Client(env.HYPERDRIVE.connectionString)
    await client.connect()

    const result = await client.query('SELECT * FROM users LIMIT 10')

    return Response.json(result.rows)
  },
}
```

### 8.3 Pricing

| Plan                      | Queries       |
| ------------------------- | ------------- |
| Free                      | 100,000/day   |
| Paid ($5/mo Workers plan) | **Unlimited** |

Connection pooling and query caching are included at no extra cost. No data transfer fees.

---

## 9. Queues (Async Message Passing)

Queues enable guaranteed-delivery async message passing between Workers.

### 9.1 Use Cases for Multi-Tenant Platforms

- Offload heavy processing (image resize, PDF generation)
- Fan-out events (tenant deployed -> invalidate cache, send webhook, update analytics)
- Buffer writes to prevent database overload
- Cross-Worker communication

### 9.2 Producer Worker

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Send a message to the queue
    await env.MY_QUEUE.send({
      type: 'tenant.deployed',
      tenantId: 'tenant-abc',
      timestamp: Date.now(),
    })

    // Send a batch
    await env.MY_QUEUE.sendBatch([
      { body: { type: 'email', to: 'user@example.com' } },
      { body: { type: 'webhook', url: 'https://...' } },
    ])

    return new Response('Queued')
  },
}
```

### 9.3 Consumer Worker

```typescript
export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { type, tenantId } = message.body

      switch (type) {
        case 'tenant.deployed':
          await invalidateCache(tenantId)
          break
        case 'email':
          await sendEmail(message.body)
          break
      }

      message.ack() // Acknowledge successful processing
    }
  },
}
```

### 9.4 Queues Pricing

| Resource          | Free     | Paid (included) | Overage       |
| ----------------- | -------- | --------------- | ------------- |
| Operations        | 10K/day  | 1M/month        | $0.40/million |
| Message retention | 24 hours | 4 days (max 14) | -             |

An "operation" = 64 KB of data written, read, or deleted. A typical message lifecycle (write + read + delete) = 3 operations.

---

## 10. Workers AI (Edge AI Inference)

Run AI models on Cloudflare's GPU fleet at the edge. 50+ open-source models available.

### 10.1 Using from Workers

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Text generation
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is Cloudflare?' },
      ],
    })

    // Text embeddings
    const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: ['Hello world', 'Cloudflare Workers'],
    })

    // Image generation
    const image = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: 'A futuristic city at sunset',
    })

    return Response.json(response)
  },
}
```

### 10.2 Workers AI Pricing

| Resource | Free    | Paid                                 |
| -------- | ------- | ------------------------------------ |
| Neurons  | 10K/day | 10K/day free, then $0.011/1K neurons |

**Popular model costs (per million tokens):**

| Model           | Input  | Output |
| --------------- | ------ | ------ |
| Llama 3.2 1B    | $0.027 | $0.201 |
| Llama 3.1 8B    | $0.282 | $0.827 |
| Llama 3.1 70B   | $0.293 | $2.253 |
| DeepSeek R1 32B | $0.497 | $4.881 |
| Mistral 7B      | $0.110 | $0.190 |

**Rate limits:** 300 req/min for text generation (varies by model), up to 3,000 req/min for embeddings.

---

## 11. Vectorize (Vector Database)

Globally distributed vector database for embeddings, RAG, and semantic search.

### 11.1 Using with Workers AI for RAG

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const query = 'How do I deploy a Worker?'

    // Generate embedding for the query
    const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [query],
    })

    // Search the vector index
    const results = await env.VECTORIZE.query(queryEmbedding.data[0], {
      topK: 5,
      returnMetadata: true,
    })

    // Use results as context for LLM
    const context = results.matches.map((m) => m.metadata.text).join('\n')

    const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: `Answer based on context:\n${context}` },
        { role: 'user', content: query },
      ],
    })

    return Response.json(answer)
  },
}
```

### 11.2 Vectorize Pricing

| Resource           | Free      | Paid (included) | Overage       |
| ------------------ | --------- | --------------- | ------------- |
| Queried dimensions | 30M/month | 50M/month       | $0.01/million |
| Stored dimensions  | 5M        | 10M             | $0.05/100M    |

No charges for CPU, memory, idle indexes, data transfer, or number of indexes.

---

## 12. Pages (Static Site Hosting)

Cloudflare Pages hosts static sites with optional server-side rendering via Pages Functions (which are Workers under the hood).

### 12.1 How It Differs from Workers

| Feature       | Workers             | Pages                            |
| ------------- | ------------------- | -------------------------------- |
| Primary use   | API, compute, logic | Full-stack apps, static sites    |
| Deployment    | `wrangler deploy`   | Git integration or direct upload |
| Static assets | Via R2 or KV        | Built-in asset serving           |
| Server-side   | Always              | Via Pages Functions              |
| Rollbacks     | Manual              | One-click instant rollback       |

### 12.2 Multi-Tenant Use

For a platform like Surgent where each tenant gets a website:

- Use **Pages** for the platform's own dashboard/marketing site
- Use **Workers for Platforms** + **R2** for tenant sites (more control over dynamic deployment)
- Or: deploy tenant static sites via the Pages Direct Upload API

### 12.3 Pages Limits

| Limit             | Free | Paid      |
| ----------------- | ---- | --------- |
| Deploys per month | 500  | Unlimited |

---

## 13. Rate Limiting

Built-in rate limiting binding for Workers, perfect for per-tenant throttling.

### 13.1 Configuration

```jsonc
{
  "rate_limits": [
    {
      "binding": "FREE_LIMITER",
      "namespace_id": "1001",
      "simple": { "limit": 100, "period": 60 },
    },
    {
      "binding": "PRO_LIMITER",
      "namespace_id": "1002",
      "simple": { "limit": 1000, "period": 60 },
    },
  ],
}
```

### 13.2 Per-Tenant Rate Limiting

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tenantId = getTenantId(request)
    const tenantPlan = await getTenantPlan(tenantId)

    // Select rate limiter based on tenant plan
    const limiter = tenantPlan === 'pro' ? env.PRO_LIMITER : env.FREE_LIMITER

    // Rate limit by tenant ID
    const { success } = await limiter.limit({ key: tenantId })

    if (!success) {
      return new Response('Rate limit exceeded', { status: 429 })
    }

    // Process request...
  },
}
```

### 13.3 Characteristics

- **Per-location** counters (not globally consistent -- eventually consistent)
- **No network latency** -- counter checks happen locally
- Period must be 10 or 60 seconds
- Shared counters possible across Workers using same `namespace_id`

---

## 14. Complete Pricing Reference

### Base Plans

| Plan                  | Monthly Cost | Notes                     |
| --------------------- | ------------ | ------------------------- |
| Workers Free          | $0           | Good for prototyping      |
| Workers Paid          | $5/month     | Required for production   |
| Workers for Platforms | $25/month    | Required for multi-tenant |

### Per-Primitive Costs (Paid Plan)

| Primitive             | Included     | Overage           | Key Metric            |
| --------------------- | ------------ | ----------------- | --------------------- |
| **Workers Requests**  | 20M/mo       | $0.30/M           | Per request           |
| **Workers CPU**       | 60M ms/mo    | $0.02/M ms        | CPU time              |
| **Workers Scripts**   | 1,000        | $0.02/script      | Per tenant script     |
| **D1 Reads**          | 25B rows/mo  | $0.001/M rows     | Rows read             |
| **D1 Writes**         | 50M rows/mo  | $1.00/M rows      | Rows written          |
| **D1 Storage**        | 5 GB         | $0.75/GB-mo       | Total across all DBs  |
| **KV Reads**          | 10M/mo       | $0.50/M           | Per key read          |
| **KV Writes**         | 1M/mo        | $5.00/M           | Per key write         |
| **KV Storage**        | 1 GB         | $0.50/GB-mo       | -                     |
| **R2 Storage**        | 10 GB/mo     | $0.015/GB-mo      | -                     |
| **R2 Class A**        | 1M/mo        | $4.50/M           | Writes                |
| **R2 Class B**        | 10M/mo       | $0.36/M           | Reads                 |
| **R2 Egress**         | **Free**     | **Free**          | -                     |
| **DO Requests**       | 1M/mo        | $0.15/M           | Includes WS messages  |
| **DO Duration**       | 400K GB-s/mo | $12.50/M GB-s     | -                     |
| **DO SQL Reads**      | 25B rows/mo  | $0.001/M rows     | -                     |
| **DO SQL Writes**     | 50M rows/mo  | $1.00/M rows      | -                     |
| **DO Storage**        | 5 GB         | $0.20/GB-mo       | -                     |
| **Queues**            | 1M ops/mo    | $0.40/M ops       | 64KB per op           |
| **AI Neurons**        | 10K/day      | $0.011/1K neurons | -                     |
| **Vectorize Queries** | 50M dims/mo  | $0.01/M dims      | -                     |
| **Vectorize Storage** | 10M dims     | $0.05/100M dims   | -                     |
| **Hyperdrive**        | Unlimited    | $0                | Included in paid plan |

### Cost Example: 1,000 Tenants

Assuming each tenant gets their own D1 database, KV namespace, and R2 bucket with moderate usage:

```
Base:                    $25/month (Workers for Platforms)
Scripts (1,000):         $0 (1,000 included)
Requests (50M/mo):       $9.00 (30M overage x $0.30/M)
CPU (100M ms/mo):        $0.80 (40M overage x $0.02/M)
D1 storage (100GB):      $71.25 (95GB overage x $0.75)
D1 reads (5B rows/mo):   $0 (within 25B included)
D1 writes (100M rows):   $50.00 (50M overage x $1.00/M)
R2 storage (500GB):      $7.35 (490GB overage x $0.015)
KV reads (20M/mo):       $5.00 (10M overage x $0.50/M)
                         --------
Total:                   ~$168.40/month for 1,000 tenants
```

---

## 15. Multi-Tenant Architecture Patterns

### 15.1 Tenant Provisioning Flow

```
User signs up on your platform
         |
         v
1. Create D1 database via API
2. Run schema migrations on the new DB
3. Create KV namespace via API
4. Create R2 bucket via API (or use shared bucket with prefix)
5. Deploy tenant Worker to dispatch namespace with bindings
6. Store tenant metadata (db_id, kv_id, bucket_name) in platform DB
7. Set up DNS/routing (subdomain or custom domain -> dispatch worker)
```

### 15.2 Complete Provisioning Code

```typescript
// platform-admin-worker/src/provision.ts

interface TenantConfig {
  slug: string
  plan: 'free' | 'pro' | 'enterprise'
  region?: string
}

const CF_API = 'https://api.cloudflare.com/client/v4'

async function provisionTenant(config: TenantConfig, env: Env) {
  const headers = {
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  // 1. Create D1 database
  const d1Res = await fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}/d1/database`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `tenant-${config.slug}-db`,
      primary_location_hint: config.region || 'wnam',
    }),
  })
  const d1 = await d1Res.json()
  const databaseId = d1.result.uuid

  // 2. Run migrations
  await fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sql: `
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, created_at TEXT DEFAULT (datetime('now')));
        CREATE TABLE pages (id TEXT PRIMARY KEY, slug TEXT, title TEXT, content TEXT, published INTEGER DEFAULT 0);
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
        INSERT INTO settings (key, value) VALUES ('plan', '${config.plan}');
      `,
    }),
  })

  // 3. Create KV namespace
  const kvRes = await fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: `tenant-${config.slug}-kv` }),
  })
  const kv = await kvRes.json()
  const kvNamespaceId = kv.result.id

  // 4. Create R2 bucket
  await fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}/r2/buckets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `tenant-${config.slug}-assets`,
      locationHint: config.region || 'wnam',
    }),
  })

  // 5. Deploy tenant Worker with bindings
  const workerCode = generateTenantWorker(config) // Your template
  const metadata = {
    main_module: 'worker.js',
    bindings: [
      { type: 'd1', name: 'DB', id: databaseId },
      { type: 'kv_namespace', name: 'KV', namespace_id: kvNamespaceId },
      { type: 'r2_bucket', name: 'ASSETS', bucket_name: `tenant-${config.slug}-assets` },
    ],
    compatibility_date: '2026-04-01',
  }

  const formData = new FormData()
  formData.append('metadata', JSON.stringify(metadata))
  formData.append(
    'worker.js',
    new Blob([workerCode], { type: 'application/javascript+module' }),
    'worker.js',
  )

  await fetch(
    `${CF_API}/accounts/${env.CF_ACCOUNT_ID}/workers/dispatch/namespaces/production/scripts/${config.slug}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: formData,
    },
  )

  // 6. Store tenant metadata
  await env.PLATFORM_DB.prepare(
    `
    INSERT INTO tenants (slug, plan, d1_database_id, kv_namespace_id, r2_bucket_name, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `,
  )
    .bind(config.slug, config.plan, databaseId, kvNamespaceId, `tenant-${config.slug}-assets`)
    .run()

  // 7. Map hostname
  await env.DOMAIN_MAP.put(`${config.slug}.yourplatform.com`, config.slug)

  return { databaseId, kvNamespaceId, bucketName: `tenant-${config.slug}-assets` }
}
```

### 15.3 Tenant Worker Template

```typescript
// The code deployed into each tenant's Worker slot

function generateTenantWorker(config: TenantConfig): string {
  return `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url);
    }
    
    // Serve static assets from R2
    const assetKey = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const asset = await env.ASSETS.get(assetKey);
    
    if (asset) {
      return new Response(asset.body, {
        headers: {
          'content-type': getContentType(assetKey),
          'cache-control': 'public, max-age=3600',
        },
      });
    }
    
    // Fallback to index.html for SPA routing
    const indexHtml = await env.ASSETS.get('index.html');
    if (indexHtml) return new Response(indexHtml.body, {
      headers: { 'content-type': 'text/html' },
    });
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleAPI(request, env, url) {
  const path = url.pathname.replace('/api', '');
  
  if (path === '/pages' && request.method === 'GET') {
    const result = await env.DB.prepare(
      "SELECT * FROM pages WHERE published = 1"
    ).all();
    return Response.json(result.results);
  }
  
  if (path === '/settings' && request.method === 'GET') {
    const cached = await env.KV.get('settings', 'json');
    if (cached) return Response.json(cached);
    
    const result = await env.DB.prepare("SELECT * FROM settings").all();
    const settings = Object.fromEntries(result.results.map(r => [r.key, r.value]));
    await env.KV.put('settings', JSON.stringify(settings), { expirationTtl: 300 });
    return Response.json(settings);
  }
  
  return new Response('Not Found', { status: 404 });
}

function getContentType(path) {
  const ext = path.split('.').pop();
  const types = {
    html: 'text/html', css: 'text/css', js: 'application/javascript',
    json: 'application/json', png: 'image/png', jpg: 'image/jpeg',
    svg: 'image/svg+xml', woff2: 'font/woff2',
  };
  return types[ext] || 'application/octet-stream';
}
`
}
```

### 15.4 Cross-Tenant Migration Pattern

```typescript
// Run a migration across all tenant databases
async function runMigration(env: Env, migrationSQL: string) {
  const tenants = await env.PLATFORM_DB.prepare('SELECT slug, d1_database_id FROM tenants').all()

  const results = []
  const batchSize = 10 // Avoid API rate limits

  for (let i = 0; i < tenants.results.length; i += batchSize) {
    const batch = tenants.results.slice(i, i + batchSize)

    const promises = batch.map(async (tenant) => {
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${tenant.d1_database_id}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: migrationSQL }),
          },
        )
        const data = await res.json()
        return { tenant: tenant.slug, success: data.success }
      } catch (error) {
        return { tenant: tenant.slug, success: false, error: error.message }
      }
    })

    results.push(...(await Promise.all(promises)))
  }

  // Track migration status
  await env.PLATFORM_DB.prepare(
    `
    INSERT INTO migrations (sql_hash, executed_at, results)
    VALUES (?, datetime('now'), ?)
  `,
  )
    .bind(hashSQL(migrationSQL), JSON.stringify(results))
    .run()

  return results
}
```

### 15.5 Security Best Practices

1. **Resource Isolation**: Each tenant should have their own D1 database, KV namespace, and R2 bucket (or prefix). Never share bindings across tenants.

2. **Custom Limits**: Always set CPU and subrequest limits via `dispatcher.get()` to prevent one tenant from consuming all resources.

3. **Outbound Workers**: Use them to control what external services tenant code can access, prevent data exfiltration, and inject platform authentication.

4. **API Rate Limiting**: Apply rate limits in the dispatch worker before forwarding to tenant Workers.

5. **Code Validation**: If tenants can upload custom code, sandbox it via Workers for Platforms (automatic V8 isolate separation). Consider additional validation before deployment.

6. **Untrusted Mode**: Workers for Platforms runs user Workers in untrusted mode by default -- do not enable trusted mode unless absolutely necessary.

---

## 16. Full Platform Blueprint

### 16.1 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR CLOUDFLARE ACCOUNT                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Platform      │  │ Platform     │  │ Platform          │ │
│  │ Dashboard     │  │ API Worker   │  │ Admin Worker      │ │
│  │ (Pages)       │──│ (Worker)     │──│ (Worker)          │ │
│  │               │  │              │  │ - Provisioning    │ │
│  │ Next.js/React │  │ - Auth       │  │ - Migrations      │ │
│  │ app           │  │ - Billing    │  │ - Monitoring      │ │
│  └──────────────┘  │ - CRUD       │  └─────────┬─────────┘ │
│                     └──────┬───────┘            │           │
│                            │                     │           │
│                     ┌──────v─────────────────────v────────┐ │
│                     │         Platform D1 Database         │ │
│                     │  - tenants, users, billing, plans   │ │
│                     └────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Dispatch Worker (routing layer)            │ │
│  │  - Receives *.yourplatform.com requests                │ │
│  │  - Authenticates, rate-limits, routes                  │ │
│  │  - env.DISPATCHER.get(tenantSlug, {}, { limits })     │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       │                                      │
│  ┌────────────────────v───────────────────────────────────┐ │
│  │           Dispatch Namespace: "production"              │ │
│  │                                                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ │ │
│  │  │tenant-a │ │tenant-b │ │tenant-c │ │  ...50,000  │ │ │
│  │  │ Worker  │ │ Worker  │ │ Worker  │ │   tenants   │ │ │
│  │  │         │ │         │ │         │ │             │ │ │
│  │  │Bindings:│ │Bindings:│ │Bindings:│ │             │ │ │
│  │  │- D1 DB  │ │- D1 DB  │ │- D1 DB  │ │             │ │ │
│  │  │- KV NS  │ │- KV NS  │ │- KV NS  │ │             │ │ │
│  │  │- R2     │ │- R2     │ │- R2     │ │             │ │ │
│  │  │- AI     │ │- AI     │ │- AI     │ │             │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │   Outbound Worker    │  │    Background Queue         │   │
│  │  - Egress control    │  │  - Deploy events            │   │
│  │  - Auth injection    │  │  - Migration jobs           │   │
│  │  - Request logging   │  │  - Analytics aggregation    │   │
│  └──────────────────────┘  └────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │   Shared Services    │  │   AI / ML Services          │   │
│  │  - Auth (DO-backed)  │  │  - Workers AI              │   │
│  │  - Billing (Stripe)  │  │  - Vectorize (per-tenant)  │   │
│  │  - Analytics Engine  │  │  - AI Gateway              │   │
│  └──────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Workers for Platforms Binding Types Reference

When deploying a user Worker via the API, these are the binding types you can attach:

```json
{
  "main_module": "worker.js",
  "compatibility_date": "2026-04-01",
  "bindings": [
    {
      "type": "d1",
      "name": "DB",
      "id": "<d1-database-uuid>"
    },
    {
      "type": "kv_namespace",
      "name": "KV",
      "namespace_id": "<kv-namespace-id>"
    },
    {
      "type": "r2_bucket",
      "name": "ASSETS",
      "bucket_name": "<bucket-name>"
    },
    {
      "type": "durable_object_namespace",
      "name": "STATE",
      "class_name": "TenantState",
      "script_name": "platform-do-worker"
    },
    {
      "type": "service",
      "name": "AUTH",
      "service": "auth-worker"
    },
    {
      "type": "queue",
      "name": "EVENTS",
      "queue_name": "tenant-events"
    },
    {
      "type": "ai",
      "name": "AI"
    },
    {
      "type": "vectorize",
      "name": "VECTORS",
      "index_name": "tenant-abc-index"
    },
    {
      "type": "hyperdrive",
      "name": "HYPERDRIVE",
      "id": "<hyperdrive-config-id>"
    },
    {
      "type": "rate_limit",
      "name": "LIMITER",
      "namespace_id": "1001",
      "simple": { "limit": 100, "period": 60 }
    }
  ]
}
```

### 16.3 Tear-Down Flow

```typescript
async function deprovisionTenant(slug: string, env: Env) {
  const tenant = await env.PLATFORM_DB.prepare('SELECT * FROM tenants WHERE slug = ?')
    .bind(slug)
    .first()

  const headers = {
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  // Delete in parallel
  await Promise.all([
    // Delete user Worker from dispatch namespace
    fetch(
      `${CF_API}/accounts/${env.CF_ACCOUNT_ID}/workers/dispatch/namespaces/production/scripts/${slug}`,
      {
        method: 'DELETE',
        headers,
      },
    ),
    // Delete D1 database
    fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}/d1/database/${tenant.d1_database_id}`, {
      method: 'DELETE',
      headers,
    }),
    // Delete KV namespace
    fetch(
      `${CF_API}/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces/${tenant.kv_namespace_id}`,
      {
        method: 'DELETE',
        headers,
      },
    ),
    // Delete R2 bucket (must be empty first)
    fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}/r2/buckets/${tenant.r2_bucket_name}`, {
      method: 'DELETE',
      headers,
    }),
  ])

  // Clean up domain mapping
  await env.DOMAIN_MAP.delete(`${slug}.yourplatform.com`)

  // Mark tenant as deleted
  await env.PLATFORM_DB.prepare("UPDATE tenants SET deleted_at = datetime('now') WHERE slug = ?")
    .bind(slug)
    .run()
}
```

### 16.4 Key Scaling Considerations

| Concern                          | Approach                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **50,000 D1 database limit**     | At scale, use shared databases with row-level isolation for smaller tenants, dedicated DBs for larger ones |
| **1M R2 bucket limit**           | Use shared buckets with tenant-prefixed keys for smaller tenants                                           |
| **API rate limits**              | 1,200 requests/5 min for management API -- batch provisioning, use queues                                  |
| **10 GB per D1 database**        | Monitor per-tenant DB sizes, archive old data to R2                                                        |
| **Cross-tenant migration speed** | Use Queues to fan out migrations, batch by 10-20 concurrent                                                |
| **Custom domains**               | Use Cloudflare for SaaS (SSL for SaaS) to handle custom domains pointing to your dispatch worker           |
| **Global latency**               | D1's `primary_location_hint` lets you co-locate databases near tenants. Workers run globally by default    |

---

## Summary: Which Primitive for What

| Need                            | Primitive                 | Pattern                                  |
| ------------------------------- | ------------------------- | ---------------------------------------- |
| Isolated runtime per tenant     | **Workers for Platforms** | Dispatch namespace + per-tenant scripts  |
| Structured data per tenant      | **D1**                    | One database per tenant (up to 50K)      |
| Real-time state / WebSockets    | **Durable Objects**       | One DO per tenant, SQLite inside         |
| Cached config / sessions        | **Workers KV**            | Namespace per tenant or shared + prefix  |
| File storage / uploads          | **R2**                    | Bucket per tenant or shared + prefix     |
| Direct file upload from browser | **R2 Presigned URLs**     | Generate in Worker, client uploads to R2 |
| Worker-to-Worker calls          | **Service Bindings**      | RPC for shared platform services         |
| External Postgres/MySQL         | **Hyperdrive**            | Connection pooling at edge               |
| Background jobs                 | **Queues**                | Provisioning, migrations, webhooks       |
| AI features                     | **Workers AI**            | Text gen, embeddings, image gen          |
| Semantic search / RAG           | **Vectorize**             | Per-tenant vector indexes                |
| Static marketing site           | **Pages**                 | Platform dashboard/marketing             |
| Per-tenant rate limiting        | **Rate Limiting binding** | Key by tenant ID                         |
| Egress control                  | **Outbound Workers**      | Block domains, inject auth, log requests |
| Per-tenant CPU/request limits   | **Custom Limits**         | `dispatcher.get(name, {}, { limits })`   |
