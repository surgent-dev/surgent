type PaymentsDocumentationSection = {
  title: string
  paragraphs?: readonly string[]
  bullets?: readonly string[]
}

export const paymentsDocumentation: {
  updatedAt: string
  intro: string
  sections: readonly PaymentsDocumentationSection[]
} = {
  updatedAt: 'March 11, 2026',
  intro:
    'This page describes how Surgent Pay works today, which routes are stable, and which assumptions matter when building against the current worker API.',
  sections: [
    {
      title: 'Architecture',
      paragraphs: [
        'The pay service is mounted by the worker at /api/pay.',
        'Dashboard traffic uses session cookies and x-pay-env. External SDK traffic uses API keys and resolves project + env from the apikey row.',
        'The public pay surface is Whop-only today.',
      ],
    },
    {
      title: 'Implemented API Surface',
      bullets: [
        'Projects: GET /projects',
        'Products: GET /products, POST /product, PUT /product/:id, POST /product/price, POST /products/sync',
        'Checkout: POST /checkout, GET /checkout/:id, GET /checkout/success/:sessionId, GET /checkout/cancel/:sessionId',
        'Access checks: POST /check',
        'Customers: GET /customers, GET /customers/:id',
        'Subscriptions: GET /subscriptions, POST /subscriptions/:id/cancel',
        'Transactions: GET /transactions, GET /project/:projectId/transactions',
        'Accounts: POST /accounts/connect/whop, GET /accounts, GET /accounts/user, GET /accounts/whop/token, GET /accounts/whop/payouts-link, GET /accounts/:id, DELETE /accounts/:id',
        'Webhooks: POST /webhooks/:processor/:env',
      ],
    },
    {
      title: 'Checkout Rules',
      bullets: [
        'POST /checkout accepts either priceId or title + amount.',
        'productId is optional at the API layer.',
        'redirectUrl and successUrl exist. There is no separate cancelUrl field in the worker schema.',
        'Idempotency is supported via idempotencyKey.',
        'GET /checkout/:id is intentionally public because the local UUID is treated as unguessable.',
      ],
    },
    {
      title: 'Worker Behavior',
      bullets: [
        'Products are versioned by productGroup and GET /products returns only the latest version per group.',
        'Price intervals allowed by the worker are week, month, and year.',
        'A product cannot mix one-time and subscription prices.',
        'Access checks look for active subscriptions first, then succeeded one-time payments with matching product metadata.',
        'Processor fee rows are aggregated per payment before transaction responses are returned.',
      ],
    },
    {
      title: 'Hosted Checkout Flow',
      bullets: [
        'The worker writes a local pay_checkout_session before creating the Whop checkout config.',
        'Surgent hosts its own checkout page and polls GET /checkout/:id.',
        'The frontend embeds WhopCheckoutEmbed using the returned sessionId.',
        'Webhook events are verified, deduplicated, queued, and processed asynchronously.',
        'Local pay_payment, pay_subscription, pay_refund, pay_dispute, and pay_invoice rows are upserted from webhook processing.',
      ],
    },
    {
      title: 'SDK Alignment',
      paragraphs: [
        'The published SDK packages align with the worker routes, auth strategy, and camelCase request/response shapes.',
        'Older examples, manual tests, and ad-hoc verification scripts were the stale parts found in the audit.',
      ],
    },
    {
      title: 'Important Constraints',
      bullets: [
        'Session-auth dashboard calls usually require ?projectId=...',
        'API key auth infers projectId automatically.',
        'There is no generic POST /accounts/connect and no Stripe seller-connect flow in the pay routes.',
        'The real webhook route includes :env even though some older docs omitted it.',
      ],
    },
  ],
} as const
