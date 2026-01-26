/**
 * Surpay SDK - Basic Usage Example
 *
 * This file demonstrates the main SDK operations using the Result pattern.
 * Run with: bun examples/basic-usage.ts
 */

import { Surpay } from '../src/index.js'

// Initialize the client
const env = typeof process !== 'undefined' ? process.env : {}
const surpay = new Surpay({
  apiKey: env.SURPAY_API_KEY ?? 'xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd',
  baseUrl: env.SURPAY_BASE_URL ?? 'http://localhost:8090',
})

// Projects are created via the Surgent dashboard or worker, not the SDK.
// Provide your project ID via environment variable or replace the placeholder.
const projectId = env.SURPAY_PROJECT_ID ?? 'your-project-id'

async function main() {
  // Generate timestamp to avoid conflicts across multiple runs
  const timestamp = Date.now()

  console.log('Using project:', projectId)

  // =========================================================================
  // 1. Create a Product
  // =========================================================================
  console.log('\nCreating product...')
  const productGroupId = crypto.randomUUID()
  const { data: product, error: productError } = await surpay.products.create({
    project_id: projectId,
    product_group_id: productGroupId,
    name: `Pro Plan ${timestamp}`,
    slug: `pro-plan-${timestamp}`,
    description: 'Full access to all features',
  })

  if (productError) {
    console.error('Failed to create product:', productError.message)
    process.exit(1)
  }
  console.log('Product created:', product.product_id, 'version:', product.version)

  // =========================================================================
  // 2. Create Prices for the Product
  // =========================================================================
  console.log('\nCreating prices...')

  // Monthly price
  const { data: monthlyPrice, error: monthlyError } = await surpay.prices.create({
    project_id: projectId,
    product_group_id: productGroupId,
    name: 'Monthly',
    price: 999, // $9.99 in cents
    price_currency: 'usd',
    recurring_interval: 'month',
  })

  if (monthlyError) {
    console.error('Failed to create monthly price:', monthlyError.message)
    process.exit(1)
  }
  console.log('Monthly price created:', monthlyPrice.product_price_id)

  // Yearly price (with discount)
  const { data: yearlyPrice, error: yearlyError } = await surpay.prices.create({
    project_id: projectId,
    product_group_id: productGroupId,
    name: 'Yearly',
    price: 9900, // $99/year (save ~17%)
    price_currency: 'usd',
    recurring_interval: 'year',
  })

  if (yearlyError) {
    console.error('Failed to create yearly price:', yearlyError.message)
    process.exit(1)
  }
  console.log('Yearly price created:', yearlyPrice.product_price_id)

  // =========================================================================
  // 3. List Products with Prices
  // =========================================================================
  console.log('\nListing products with prices...')
  const { data: productsWithPrices, error: listError } = await surpay.products.listWithPrices(projectId)

  if (listError) {
    console.error('Failed to list products:', listError.message)
    process.exit(1)
  }

  for (const { product: p, prices } of productsWithPrices) {
    console.log(`- ${p.name} (${prices.length} prices)`)
    for (const price of prices) {
      const amount = price.price_amount ?? 0
      const currency = price.price_currency?.toUpperCase() ?? 'USD'
      const interval = price.recurring_interval ? `/${price.recurring_interval}` : ' one-time'
      console.log(`  - $${(amount / 100).toFixed(2)} ${currency}${interval}`)
    }
  }

  // =========================================================================
  // 4. Create a Checkout Session
  // =========================================================================
  console.log('\nCreating checkout session...')
  const { data: checkout, error: checkoutError } = await surpay.checkout.create({
    product_id: product.product_id,
    price_id: monthlyPrice.product_price_id,
    success_url: 'https://localhost:8090/success',
    cancel_url: 'https://localhost:8090/cancel',
  })

  if (checkoutError) {
    console.error('Failed to create checkout:', checkoutError.message)
    process.exit(1)
  }
  console.log('Checkout URL:', checkout.checkout_url)
  console.log('Session ID:', checkout.session_id)

  // =========================================================================
  // 5. List Customers (after some have signed up)
  // =========================================================================
  console.log('\nListing customers...')
  const { data: customers, error: customersError } = await surpay.customers.list(projectId)

  if (customersError) {
    console.error('Failed to list customers:', customersError.message)
    process.exit(1)
  }
  console.log(`Found ${customers.length} customers`)

  if (customers.length > 0) {
    // Get detailed info for first customer
    const { data: customer, error: customerError } = await surpay.customers.get(projectId, customers[0].id)

    if (customerError) {
      console.error('Failed to get customer:', customerError.message)
    } else {
      console.log('Customer:', customer.email)
      console.log('Subscriptions:', customer.subscriptions.length)
      console.log('Transactions:', customer.transactions.length)
    }
  }

  // =========================================================================
  // 6. List Subscriptions
  // =========================================================================
  console.log('\nListing subscriptions...')
  const { data: subscriptions, error: subsError } = await surpay.subscriptions.list(projectId)

  if (subsError) {
    console.error('Failed to list subscriptions:', subsError.message)
    process.exit(1)
  }
  const activeCount = subscriptions.filter((s) => s.status === 'active').length
  console.log(`${activeCount} active / ${subscriptions.length} total subscriptions`)

  // =========================================================================
  // 7. List Transactions
  // =========================================================================
  console.log('\nListing transactions...')
  const { data: transactions, error: txError } = await surpay.transactions.list(projectId)

  if (txError) {
    console.error('Failed to list transactions:', txError.message)
    process.exit(1)
  }
  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0)
  console.log(`Total revenue: $${(totalRevenue / 100).toFixed(2)}`)

  console.log('\nDone!')
}

main()
