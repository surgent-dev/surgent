# Custom Domains

How users purchase and connect custom domains to their deployed projects via Entri.

## Architecture

```
User (browser)
  │
  ├─ Search domain → POST /api/domains/check-availability → Entri API
  │
  ├─ Purchase      → POST /api/domains/init-purchase
  │                     ├─ create pending domain record
  │                     ├─ generate Entri JWT (1hr)
  │                     ├─ build DNS records (A → {ENTRI_SERVERS})
  │                     └─ return config for Entri modal
  │
  ├─ Entri Modal (SDK)
  │    └─ user completes purchase inside Entri iframe
  │
  └─ Entri Webhooks → POST /api/domains/webhooks/entri
                        ├─ verify HMAC-SHA256 signature
                        ├─ store event in domain_webhook_event
                        ├─ domain.added     → status: dns_configuring or active
                        ├─ domain.failed    → status: error
                        └─ dns.propagated   → status: active
```

## Full Flow

```
User clicks "Purchase"
│
▼
╔══════════════════════════════════════════════════════════════════╗
║  1. CHECK AVAILABILITY                                          ║
║     POST /api/domains/check-availability { domain }             ║
║     → Entri API (GET https://api.goentri.com/checkdomainavail.) ║
║     → Dev mode: mock response (google.com etc → unavailable)    ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ unavailable → show X, stop
│
▼ available
╔══════════════════════════════════════════════════════════════════╗
║  2. INIT PURCHASE                                                ║
║     POST /api/domains/init-purchase { projectId, suggestedDomain }║
╚══════════════════════════════════════════════════════════════════╝
│
├─ verify project belongs to user's org
├─ check no existing active/purchasing/dns_configuring domain (409)
├─ look up worker.scriptName for DNS target
│    dnsTarget = {scriptName}.surgent.site
│    fallback  = {projectId[0:8]}.surgent.site
├─ generate DNS records:
│    A @ → {ENTRI_SERVERS} (TTL 300)
├─ create pending domain record in DB
├─ generate Entri JWT (HS256, 1hr expiry)
│
▼ return { token, applicationId, dnsRecords, domainId, contact, devMode }
╔══════════════════════════════════════════════════════════════════╗
║  3. LAUNCH ENTRI MODAL (or dev mock)                             ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ Dev mode:
│    POST /api/domains/mock-purchase { domainId, domainName }
│    → instantly set domain status = 'active', registrar = 'mock-dev'
│    → done
│
├─ Entri SDK available:
│    window.entri.showEntri(config)
│    → user purchases domain inside Entri iframe
│    → onSuccess callback → invalidate queries, show toast
│
├─ Entri SDK unavailable (fallback):
│    → open https://app.goentri.com/sell?domain=... in new tab
│
▼ user completes purchase
╔══════════════════════════════════════════════════════════════════╗
║  4. ENTRI WEBHOOK — domain.added / domainPurchased               ║
║     POST /api/domains/webhooks/entri                              ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ verify HMAC-SHA256 signature (timing-safe XOR comparison)
├─ store raw event in domain_webhook_event
├─ find pending/purchasing domain record for user
├─ propagation_status === 'success' OR dns_status === 'configured'?
│    ├─ yes → status = 'active'
│    └─ no  → status = 'dns_configuring'
├─ set registrar, entriFlowId, purchasedAt
│
▼ if DNS not yet propagated
╔══════════════════════════════════════════════════════════════════╗
║  5. ENTRI WEBHOOK — dns.propagated / dnsConfigured               ║
║     POST /api/domains/webhooks/entri                              ║
╚══════════════════════════════════════════════════════════════════╝
│
├─ verify signature
├─ UPDATE domain SET status = 'active' WHERE status = 'dns_configuring'
│
▼ domain is live
```

## Domain Status Lifecycle

```
pending → purchasing → dns_configuring → active
                ↓                            ↑
              error                     dns.propagated
```

| Status            | Meaning                                        | UI indicator          |
| ----------------- | ---------------------------------------------- | --------------------- |
| `pending`         | Domain record created, awaiting Entri purchase | Spinner, "Pending"    |
| `purchasing`      | Purchase in progress via Entri                 | Spinner, "Purchasing" |
| `dns_configuring` | Purchased, waiting for DNS propagation         | Amber pulsing dot     |
| `active`          | DNS propagated, domain is live                 | Green dot, "Live"     |
| `error`           | Purchase failed                                | —                     |

## API Endpoints

All auth-protected endpoints require a valid session (Better Auth).

### `POST /api/domains/check-availability`

Check if a domain can be purchased.

**Request:**

```json
{ "domain": "myapp.com" }
```

**Response:**

```json
{
  "domain": "myapp.com",
  "available": true,
  "reason": "AVAILABLE",
  "checkedAt": "2026-03-02T00:00:00.000Z"
}
```

Reason values: `AVAILABLE`, `UNAVAILABLE`, `UNSUPPORTED_TLD`, `ERROR`

In dev mode (no `ENTRI_API_KEY`), returns mock results. The following domains are always "unavailable": google.com, facebook.com, amazon.com, apple.com, microsoft.com, github.com, surgent.dev, example.com.

### `POST /api/domains/init-purchase`

Initialize the Entri purchase flow. Creates a pending domain record and returns config for the Entri modal.

**Request:**

```json
{
  "projectId": "uuid",
  "suggestedDomain": "myapp.com"
}
```

**Response:**

```json
{
  "token": "eyJhbGci...",
  "applicationId": "entri-app-id",
  "dnsRecords": [
    {
      "type": "A",
      "host": "@",
      "value": "{ENTRI_SERVERS}",
      "ttl": 300,
      "applicationUrl": "https://worker-name.surgent.site"
    }
  ],
  "domainId": "uuid",
  "prefilledDomain": "myapp.com",
  "devMode": false,
  "contact": { "email": "user@example.com", "firstName": "John", "lastName": "Doe" }
}
```

**Error cases:**

| Case                              | Status |
| --------------------------------- | ------ |
| Project not found                 | 404    |
| Project belongs to different org  | 403    |
| Project already has active domain | 409    |

### `GET /api/domains/:projectId`

List all domains for a project. Returns most recent first.

**Response:**

```json
{
  "domains": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "domainName": "myapp.com",
      "status": "active",
      "registrar": "NameCheap",
      "purchasedAt": "2026-03-02T00:00:00.000Z",
      "expiresAt": null,
      "createdAt": "2026-03-02T00:00:00.000Z"
    }
  ]
}
```

### `DELETE /api/domains/:projectId/:domainId`

Remove a domain record from the database. Does **not** cancel the domain at the registrar.

**Response:** `{ "deleted": true }`

### `POST /api/domains/mock-purchase` (dev only)

Instantly activate a domain without going through Entri. Only available when `devMode` is true.

**Request:**

```json
{ "domainId": "uuid", "domainName": "myapp.com" }
```

**Response:** `{ "ok": true, "domainName": "myapp.com", "status": "active" }`

### `POST /api/domains/webhooks/entri` (no auth)

Receives webhook events from Entri. Secured via HMAC-SHA256 signature verification.

**Headers:** `x-entri-signature` — hex-encoded HMAC-SHA256 of the raw request body.

**Events handled:**

| Event type                         | Action                                                           |
| ---------------------------------- | ---------------------------------------------------------------- |
| `domain.added` / `domainPurchased` | Set status to `active` or `dns_configuring` based on propagation |
| `domain.failed` / `domainFailed`   | Set status to `error`                                            |
| `dns.propagated` / `dnsConfigured` | Set status to `active` (from `dns_configuring`)                  |
| Other                              | Logged, no action                                                |

All events are stored in `domain_webhook_event` for audit.

## Database Schema

### `domain` table

| Column             | Type         | Constraints                                |
| ------------------ | ------------ | ------------------------------------------ |
| `id`               | uuid         | PK, auto-generated                         |
| `projectId`        | uuid         | FK → project.id, ON DELETE SET NULL        |
| `userId`           | uuid         | FK → user.id, ON DELETE CASCADE, NOT NULL  |
| `organizationId`   | uuid         | —                                          |
| `domainName`       | varchar(255) | NOT NULL, UNIQUE                           |
| `status`           | varchar(30)  | NOT NULL, default `'pending'`              |
| `registrar`        | varchar(100) | Registrar name from Entri                  |
| `entriFlowId`      | varchar(255) | Entri transaction ID                       |
| `cfCustomDomainId` | varchar(255) | Reserved for future Cloudflare integration |
| `purchasedAt`      | timestamptz  | —                                          |
| `expiresAt`        | timestamptz  | —                                          |
| `createdAt`        | timestamptz  | NOT NULL, default `now()`                  |
| `updatedAt`        | timestamptz  | NOT NULL, default `now()`                  |

**Indexes:**

- `domain_project_id_idx` — on `projectId`
- `domain_user_id_idx` — on `userId`
- `domain_domain_name_unique` — unique on `domainName`

### `domain_webhook_event` table

| Column         | Type         | Constraints                    |
| -------------- | ------------ | ------------------------------ |
| `id`           | uuid         | PK, auto-generated             |
| `entriEventId` | varchar(255) | Entri event ID                 |
| `eventType`    | varchar(100) | NOT NULL                       |
| `domainName`   | varchar(255) | —                              |
| `payload`      | jsonb        | NOT NULL, full webhook payload |
| `status`       | varchar(20)  | NOT NULL, default `'pending'`  |
| `error`        | text         | —                              |
| `createdAt`    | timestamptz  | NOT NULL, default `now()`      |
| `processedAt`  | timestamptz  | —                              |

**Indexes:**

- `domain_webhook_event_status_idx` — on `(status, createdAt)`

## Entri Integration

### JWT Generation

The backend generates a JWT for Entri's sell modal (`apps/worker/src/lib/entri/jwt.ts`):

- **Algorithm:** HS256 (HMAC-SHA256)
- **Secret:** `ENTRI_SECRET` env var
- **Expiration:** 1 hour
- **Payload:** `{ applicationId, userId, iat, exp }`

### Availability API

`EntriClient` (`apps/worker/src/lib/entri/client.ts`) calls `GET https://api.goentri.com/checkdomainavailability` with headers:

- `Authorization: {ENTRI_API_KEY}`
- `applicationId: {ENTRI_APP_ID}`
- `domain: {domain}`
- Timeout: 15 seconds

### Webhook Signature Verification

1. Import `ENTRI_WEBHOOK_SECRET` as HMAC key (SHA-256)
2. Sign the raw request body
3. Compare hex-encoded result with `x-entri-signature` header
4. Uses timing-safe XOR comparison to prevent timing attacks

## DNS Configuration

When a domain is purchased, two CNAME records are configured to point to the project's Cloudflare Worker:

```
@   CNAME → {scriptName}.surgent.site   TTL 300
A @ → {ENTRI_SERVERS}   TTL 300
```

The `scriptName` comes from the `worker` table for the project. If no worker exists, falls back to `{projectId[0:8]}.surgent.site`.

## Frontend

### Where it appears

The `DomainSearchPanel` component is rendered inside the deployment status dialog (`apps/web/components/deployment-status-dialog.tsx`) — only visible when:

1. The project has a `projectId`
2. The worker status is `active` (deployment is live)

### Component states

1. **Active domain** — shows domain name with green dot ("Live") or amber pulsing dot ("Configuring DNS..."), with open-in-new-tab and delete buttons
2. **Pending domain** — shows spinner with "Waiting for purchase..." or the domain name
3. **Search & purchase** — search input, availability result, purchase button

### Auto-refresh

`useProjectDomains` polls the backend:

- Every **3 seconds** while any domain is `pending`, `purchasing`, or `dns_configuring`
- Every **30 seconds** when stable

## Environment Variables

| Variable               | Required   | Description                                 |
| ---------------------- | ---------- | ------------------------------------------- |
| `ENTRI_APP_ID`         | Yes (prod) | Entri application ID                        |
| `ENTRI_SECRET`         | Yes (prod) | JWT signing secret for Entri                |
| `ENTRI_API_KEY`        | Yes (prod) | Entri API key for availability checks       |
| `ENTRI_WEBHOOK_SECRET` | Yes (prod) | HMAC secret for webhook signature verify    |
| `ENTRI_DEV_MODE`       | No         | Set `true` to force dev mode                |
| `DEPLOY_DOMAIN`        | No         | DNS target domain (default: `surgent.site`) |

**Dev mode** is auto-enabled when `ENTRI_API_KEY` is not set and `NODE_ENV !== 'production'`.

## File Map

```
apps/worker/src/
├── routes/domains.ts              All domain routes + webhook handler
├── lib/entri/
│   ├── client.ts                  EntriClient — availability check API
│   └── jwt.ts                     Entri JWT generation (HS256)
├── lib/config.ts                  entri.* and cloudflare.* config

apps/web/
├── components/domains/
│   └── domain-search-panel.tsx    Search, purchase, and status UI
├── queries/domains.ts             React Query hooks for domain API
├── components/
│   └── deployment-status-dialog.tsx  Renders DomainSearchPanel when live

packages/db/src/
├── migrations/026_custom_domains.ts  domain + domain_webhook_event tables
└── types.ts                          DomainTable, DomainStatus types
```
