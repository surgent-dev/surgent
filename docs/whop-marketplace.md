# Whop Marketplace Transfer Model

A marketplace where buyers pay the platform and sellers receive payouts via Whop transfers.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Buyer     │─────▶│  Platform (Whop) │─────▶│  Merchant (Whop)│
│             │ pays │  biz_PLATFORM    │ transfer│  biz_MERCHANT  │
└─────────────┘      └──────────────────┘      └─────────────────┘
                              │
                     platform fee kept
```

## Flow

### 1. Merchant Onboarding

```
POST /api/marketplace/merchant/onboard
```

- Creates merchant record linked to user
- Optionally creates Whop sub-company under platform

### 2. Product & Pricing

```
POST /api/marketplace/products        → Create product with price
POST /api/marketplace/products/:id/prices → Add price tier
```

### 3. Checkout

```
POST /api/marketplace/checkout { productId, priceId }
```

- Creates order (status: `pending`)
- Creates Whop checkout session on **platform company**
- Returns `purchaseUrl` for buyer

### 4. Payment → Transfer (Webhook Flow)

```
Whop ──webhook──▶ POST /api/webhooks/whop
                         │
                   verify signature
                   dedup by webhook-id
                   insert to DB (ON CONFLICT DO NOTHING)
                         │
                   enqueue to Cloudflare Queue
                         │
                         ▼
              Queue Consumer (processWebhookBatch)
                         │
                   claim event (pending → processing)
                         │
                   payment_succeeded?
                         │
                   ├─ update order → paid
                   ├─ calculate payout (gross - platform fee)
                   ├─ insert transfer record (idempotency key)
                   └─ whop.transfers.create()
                         │
                   mark event processed
```

## Webhook Endpoint

- Receiver path: `POST /api/webhooks/whop`
- If your public API base is `https://prod.piedpiper.com/api/v1`, set the Whop webhook endpoint to `https://prod.piedpiper.com/api/v1/webhooks/whop`.
- The receiver reads the raw body (`text()`) to verify the webhook signature.

## Webhook Events

We accept and store all events below; only `payment_succeeded` and `payment_failed` currently trigger marketplace order/transfer logic (dot-style variants like `payment.succeeded` are also supported).

- `invoice_created`
- `invoice_paid`
- `invoice_past_due`
- `invoice_voided`
- `membership_activated`
- `membership_deactivated`
- `entry_created`
- `entry_approved`
- `entry_denied`
- `entry_deleted`
- `setup_intent_requires_action`
- `setup_intent_succeeded`
- `setup_intent_canceled`
- `withdrawal_created`
- `withdrawal_updated`
- `course_lesson_interaction_completed`
- `payment_created`
- `payment_succeeded`
- `payment_failed`
- `payment_pending`
- `dispute_created`
- `dispute_updated`
- `refund_created`
- `refund_updated`

## Idempotency (3 Layers)

| Layer             | Mechanism                                        |
| ----------------- | ------------------------------------------------ |
| Webhook ingestion | `webhookId` UNIQUE + `ON CONFLICT DO NOTHING`    |
| Transfer record   | `idempotencyKey = transfer_{paymentId}` UNIQUE   |
| Whop API          | `idempotence_key` passed to `transfers.create()` |

## Database Schema

```
merchants
  id (PK, refs user.id)
  whopCompanyId (unique)

products
  merchantId → merchants.id

product_prices
  productId → products.id

orders
  merchantId → merchants.id
  customerId → user.id
  whopPaymentId (unique)
  status: pending | paid | fulfilled | failed

whop_transfers
  orderId → orders.id (unique)
  idempotencyKey (unique)
  status: pending | succeeded | failed

whop_webhook_events
  webhookId (unique)
  status: pending | processing | processed | failed
  attempts
```

## Platform Fee

```ts
fee = max((amount * bps) / 10000, fixed)
payout = amount - fee
```

Configured via env:

- `PLATFORM_FEE_BPS` (default 1000 = 10%)
- `PLATFORM_FEE_FIXED` (default 0)

## Queue Config (wrangler.jsonc)

```jsonc
"queues": {
  "producers": [{ "binding": "WHOP_WEBHOOK_QUEUE", "queue": "whop-webhooks" }],
  "consumers": [{
    "queue": "whop-webhooks",
    "max_batch_size": 10,
    "max_batch_timeout": 5,
    "max_retries": 3,
    "dead_letter_queue": "whop-webhooks-dlq"
  }]
}
```

## Environment Variables

| Variable              | Description               |
| --------------------- | ------------------------- |
| `WHOP_API_KEY`        | Platform company API key  |
| `PLATFORM_COMPANY_ID` | Platform's `biz_...` ID   |
| `WHOP_WEBHOOK_SECRET` | Webhook signing secret    |
| `PLATFORM_FEE_BPS`    | Basis points (1000 = 10%) |
| `PLATFORM_FEE_FIXED`  | Fixed fee floor           |

## Files

```
apps/worker/
├── src/
│   ├── index.ts                  # Exports fetch + queue handler
│   ├── routes/
│   │   ├── marketplace.ts        # Merchant/product/checkout API
│   │   └── whop-webhooks.ts      # Webhook receiver
│   ├── services/
│   │   ├── whop.ts               # SDK client + signature verification
│   │   └── marketplace.ts        # Business logic + DB operations
│   └── queues/
│       └── webhook-consumer.ts   # Queue batch processor
└── wrangler.jsonc                # Queue bindings

packages/db/src/migrations/
└── 004_whop_platform_transfers.ts  # Schema
```
