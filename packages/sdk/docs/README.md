# Surpay SDK for TypeScript

The Surpay SDK provides a simple and type-safe way to interact with the Surpay API.

## Installation

```bash
bun add surpay
# or
npm install surpay
```

## Quick Start

```typescript
import { Surpay } from 'surpay'

const surpay = new Surpay({
  apiKey: 'xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd',
})

async function example() {
  const { data: projects, error } = await surpay.projects.list()

  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log('Projects:', projects)
}
```

## Configuration

The SDK can be configured via the constructor or environment variables.

```typescript
import { Surpay } from 'surpay'

const surpay = new Surpay({
  apiKey: process.env.SURPAY_API_KEY, // Fallback: SURPAY_API_KEY env var
  baseUrl: 'https://api.surpay.io', // Optional
})
```

## Result Pattern & Error Handling

All SDK methods return a `Promise<Result<T, SurpayError>>`.

```typescript
const result = await surpay.projects.list()

if (result.error) {
  // Handle error
  console.error(result.error.message)
  console.error(result.error.code)
  console.error(result.statusCode)
} else {
  // Use data
  console.log(result.data)
}
```

### Error Helper

Use `isSurpayError` to check if an error object is a `SurpayError`.

```typescript
import { isSurpayError } from 'surpay'

try {
  // ...
} catch (err) {
  if (isSurpayError(err)) {
    console.error(err.code)
  }
}
```

## API Reference

### Projects

Note: Projects are created via the Surgent dashboard. The SDK provides read-only access to list your projects.

```typescript
// List projects
const { data: projects } = await surpay.projects.list()
```

### Products

Manage products within a project.

```typescript
// Create a product
const { data } = await surpay.products.create({
  project_id: 'proj_123',
  product_group_id: 'group_456',
  name: 'Pro Plan',
  slug: 'pro-plan',
})

// Update a product
await surpay.products.update('prod_123', {
  name: 'Pro Plan v2',
})

// List products with their prices
const { data: products } = await surpay.products.listWithPrices('proj_123')
```

### Prices

Manage pricing for your products.

```typescript
// Create a price
const { data } = await surpay.prices.create({
  project_id: 'proj_123',
  product_group_id: 'group_456',
  name: 'Monthly',
  price: 999, // $9.99
  price_currency: 'usd',
  recurring_interval: 'month',
})
```

### Checkout

Create hosted checkout sessions.

```typescript
// Create a checkout session
const { data } = await surpay.checkout.create({
  product_id: 'prod_123',
  price_id: 'price_456',
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
})

console.log(data.checkout_url)
```

### Customers

Retrieve customer information.

```typescript
// List customers
const { data: customers } = await surpay.customers.list('proj_123')

// Get customer with details (subscriptions & transactions)
const { data: customer } = await surpay.customers.get('proj_123', 'cust_123')
```

### Subscriptions

Monitor active subscriptions.

```typescript
// List subscriptions
const { data: subscriptions } = await surpay.subscriptions.list('proj_123')
```

### Transactions

Track payments and revenue.

```typescript
// List transactions
const { data: transactions } = await surpay.transactions.list('proj_123')
```

### Accounts

Manage connected payment processor accounts.

```typescript
// Connect a new account (Stripe)
const { data } = await surpay.accounts.connect({
  processor: 'stripe',
})

// Get account details
const { data: account } = await surpay.accounts.get('acc_123')

// List connected accounts
const { data: accounts } = await surpay.accounts.list()
```
