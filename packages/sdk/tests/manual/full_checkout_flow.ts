/**
 * Surpay SDK - Full Checkout Flow Example
 *
 * This file demonstrates running through a complete checkout flow including
 * product creation, prices, checkout session, and listing
 * customers/subscriptions/transactions.
 *
 * Usage: bun run tests/manual/full_checkout_flow.ts
 */

import { Surpay } from '../../src/index.js'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const env = typeof process !== 'undefined' ? process.env : {}
const rl = readline.createInterface({ input, output })
const surpay = new Surpay({
  apiKey: env.SURPAY_API_KEY ?? 'xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd',
  baseUrl: env.SURPAY_BASE_URL ?? 'http://localhost:8090',
})

async function main() {
  // =========================================================================
  // Project Setup - Interactive Selection
  // =========================================================================
  console.log('Fetching existing projects...\n')
  const { data: projects, error: listError } = await surpay.projects.list()

  if (listError) {
    console.error('Failed to list projects:', listError.message)
    process.exit(1)
  }

  let projectId: string

  // Ensure projects is always an array
  const projectList = Array.isArray(projects) ? projects : []

  console.log('='.repeat(50))
  console.log('SELECT A PROJECT')
  console.log('='.repeat(50))

  if (projectList.length === 0) {
    console.log('No projects found. Create a project via the Surgent dashboard.')
    process.exit(1)
  }

  for (let i = 0; i < projectList.length; i++) {
    const p = projectList[i]
    console.log(`[${i + 1}] ${p.name} (ID: ${p.id})`)
  }

  const projectChoice = await rl.question('\nEnter your choice: ')
  const selectedIndex = parseInt(projectChoice, 10) - 1

  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= projectList.length) {
    console.log('Invalid selection. Exiting.')
    process.exit(1)
  }

  projectId = projectList[selectedIndex].id
  console.log(`\nSelected project: ${projectList[selectedIndex].name}`)

  // =========================================================================
  // List Existing Prices
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('EXISTING PRICES')
  console.log('='.repeat(50))

  const { data: productsWithPrices, error: pricesError } = await surpay.products.listWithPrices(projectId)

  const allPrices: Array<{ price: any; product: any; index: number }> = []
  const createdThisSession: Array<{ name: string; id: string; amount: number; currency: string; interval?: string }> =
    []

  if (pricesError || !productsWithPrices || productsWithPrices.length === 0) {
    console.log('No existing prices found in the project.')
    console.log('You can create sample prices or custom prices from the menu below.\n')
  } else {
    let priceIndex = 1
    for (const productWithPrices of productsWithPrices) {
      if (productWithPrices.prices.length > 0) {
        console.log(`\nProduct: ${productWithPrices.product.name}`)
        for (const price of productWithPrices.prices) {
          const amount = price.price_amount ?? 0
          const currency = price.price_currency?.toUpperCase() ?? 'USD'
          const interval = price.recurring_interval ? ` / ${price.recurring_interval}` : ''
          console.log(`  [${priceIndex}] ${price.name || 'Unnamed'} - $${(amount / 100).toFixed(2)}${interval}`)
          console.log(`      ID: ${price.id}`)

          allPrices.push({
            price,
            product: productWithPrices.product,
            index: priceIndex,
          })
          priceIndex++
        }
      }
    }
    console.log(`\nTotal prices: ${allPrices.length}`)
  }

  // =========================================================================
  // Interactive CLI Menu
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('What would you like to do?')
  console.log('='.repeat(50))
  console.log('1. Checkout an existing price' + (allPrices.length > 0 ? '' : ' (no prices available)'))
  console.log('2. Create sample product + prices (Pro Plan with Monthly/Yearly)')
  console.log('3. Create custom product + price and checkout')
  console.log('4. Only pull data (skip checkout)')

  const choice = await rl.question('\nEnter your choice (1-4): ')

  if (choice === '1') {
    if (allPrices.length === 0) {
      console.log('\nNo prices available. Please create prices first (options 2 or 3).')
    } else {
      const priceChoice = await rl.question(`\nEnter price number (1-${allPrices.length}): `)
      const selectedIndex = parseInt(priceChoice, 10) - 1

      if (selectedIndex >= 0 && selectedIndex < allPrices.length) {
        const selected = allPrices[selectedIndex]
        console.log(`\nCreating checkout for: ${selected.price.name || 'Unnamed'}`)

        const { data: checkout, error: checkoutError } = await surpay.checkout.create({
          product_id: selected.product.id,
          price_id: selected.price.id,
          success_url: 'https://localhost:8090/success',
          cancel_url: 'https://localhost:8090/cancel',
        })

        if (checkoutError) {
          console.error('Failed to create checkout:', checkoutError.message)
        } else {
          console.log('Checkout URL:', checkout.checkout_url)
          console.log('Session ID:', checkout.session_id)
        }
      } else {
        console.log('Invalid selection.')
      }
    }
  } else if (choice === '2') {
    // Create sample product + prices (Pro Plan)
    const sampleTimestamp = Date.now()
    const sampleProductGroupId = crypto.randomUUID()

    console.log('\nCreating sample product (Pro Plan)...')
    const { data: sampleProduct, error: sampleProductError } = await surpay.products.create({
      project_id: projectId,
      product_group_id: sampleProductGroupId,
      name: `Pro Plan ${sampleTimestamp}`,
      slug: `pro-plan-${sampleTimestamp}`,
      description: 'Full access to all features',
    })

    if (sampleProductError) {
      console.error('Failed to create sample product:', sampleProductError.message)
    } else {
      console.log('Sample product created:', sampleProduct.product_id)

      // Monthly price
      console.log('\nCreating monthly price...')
      const monthlyPriceRequest = {
        project_id: projectId,
        product_group_id: sampleProductGroupId,
        name: 'Monthly',
        price: 999, // $9.99 in cents
        price_currency: 'usd',
        recurring_interval: 'month' as const,
      }
      const { data: monthlyPrice, error: monthlyError } = await surpay.prices.create(monthlyPriceRequest)

      if (monthlyError) {
        console.error('Failed to create monthly price:', monthlyError.message)
      } else {
        console.log('Monthly price created:', monthlyPrice.product_price_id)
        createdThisSession.push({
          name: monthlyPriceRequest.name,
          id: monthlyPrice.product_price_id,
          amount: monthlyPriceRequest.price,
          currency: monthlyPriceRequest.price_currency,
          interval: monthlyPriceRequest.recurring_interval,
        })
      }

      // Yearly price (with discount)
      console.log('Creating yearly price...')
      const yearlyPriceRequest = {
        project_id: projectId,
        product_group_id: sampleProductGroupId,
        name: 'Yearly',
        price: 9900, // $99/year (save ~17%)
        price_currency: 'usd',
        recurring_interval: 'year' as const,
      }
      const { data: yearlyPrice, error: yearlyError } = await surpay.prices.create(yearlyPriceRequest)

      if (yearlyError) {
        console.error('Failed to create yearly price:', yearlyError.message)
      } else {
        console.log('Yearly price created:', yearlyPrice.product_price_id)
        createdThisSession.push({
          name: yearlyPriceRequest.name,
          id: yearlyPrice.product_price_id,
          amount: yearlyPriceRequest.price,
          currency: yearlyPriceRequest.price_currency,
          interval: yearlyPriceRequest.recurring_interval,
        })
      }

      console.log('\nSample product + prices created successfully!')
      console.log('You can now select option 1 to checkout with any price.')
    }
  } else if (choice === '3') {
    // Create custom product + price and checkout
    const priceType = await rl.question('\nPrice type (recurring/one-time): ')
    const amountInput = await rl.question('Price amount in dollars (e.g., 9.99): ')
    const amountCents = Math.round(parseFloat(amountInput) * 100)

    let interval: 'month' | 'year' | 'week' | 'day' | undefined
    if (priceType === 'recurring') {
      const intervalInput = await rl.question('Recurring interval (month/year/week/day): ')
      interval = intervalInput as 'month' | 'year' | 'week' | 'day'
    }

    const newProductGroupId = crypto.randomUUID()
    const newTimestamp = Date.now()

    console.log('\nCreating new product...')
    const { data: newProduct, error: newProductError } = await surpay.products.create({
      project_id: projectId,
      product_group_id: newProductGroupId,
      name: `Custom Product ${newTimestamp}`,
      slug: `custom-product-${newTimestamp}`,
      description: 'Product created for checkout',
    })

    if (newProductError) {
      console.error('Failed to create product:', newProductError.message)
    } else {
      console.log('Product created:', newProduct.product_id)

      console.log('Creating new price...')
      const priceName = priceType === 'recurring' ? `Recurring $${amountInput}` : `One-time $${amountInput}`
      const { data: newPrice, error: newPriceError } = await surpay.prices.create({
        project_id: projectId,
        product_group_id: newProductGroupId,
        name: priceName,
        price: amountCents,
        price_currency: 'usd',
        ...(interval && { recurring_interval: interval }),
      })

      if (newPriceError) {
        console.error('Failed to create price:', newPriceError.message)
      } else {
        console.log('Price created:', newPrice.product_price_id)
        createdThisSession.push({
          name: priceName,
          id: newPrice.product_price_id,
          amount: amountCents,
          currency: 'usd',
          interval: interval,
        })

        console.log('\nCreating checkout session...')
        const { data: checkout, error: checkoutError } = await surpay.checkout.create({
          product_id: newProduct.product_id,
          price_id: newPrice.product_price_id,
          success_url: 'https://localhost:8090/success',
          cancel_url: 'https://localhost:8090/cancel',
        })

        if (checkoutError) {
          console.error('Failed to create checkout:', checkoutError.message)
        } else {
          console.log('Checkout URL:', checkout.checkout_url)
          console.log('Session ID:', checkout.session_id)
        }
      }
    }
  } else if (choice === '4') {
    console.log('\nSkipping checkout, displaying data only...')
  } else {
    console.log('\nInvalid choice. Skipping checkout...')
  }

  rl.close()

  // =========================================================================
  // 4. List Customers
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('CUSTOMERS')
  console.log('='.repeat(50))
  const { data: customers, error: customersError } = await surpay.customers.list(projectId)

  if (customersError) {
    console.error('Failed to list customers:', customersError.message)
  } else {
    console.log(`Found ${customers.length} customers`)

    if (customers.length > 0) {
      console.log('\nRecent customers:')
      const recentCustomers = customers.slice(0, 5)
      for (const customer of recentCustomers) {
        console.log(`  - ${customer.email || 'No email'} (ID: ${customer.id})`)
      }
      if (customers.length > 5) {
        console.log(`  ... and ${customers.length - 5} more`)
      }

      // Get detailed info for first customer
      const { data: customerDetails, error: customerDetailError } = await surpay.customers.get(
        projectId,
        customers[0].id,
      )

      if (!customerDetailError && customerDetails) {
        console.log('\nFirst customer details:')
        console.log(`  Email: ${customerDetails.email || 'No email'}`)
        console.log(`  Subscriptions: ${customerDetails.subscriptions.length}`)
        console.log(`  Transactions: ${customerDetails.transactions.length}`)
      }
    }
  }

  // =========================================================================
  // 5. List Subscriptions
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('SUBSCRIPTIONS')
  console.log('='.repeat(50))
  const { data: subscriptions, error: subsError } = await surpay.subscriptions.list(projectId)

  if (subsError) {
    console.error('Failed to list subscriptions:', subsError.message)
  } else {
    console.log(`Total subscriptions: ${subscriptions.length}`)

    // Count by status
    const statusCounts: Record<string, number> = {}
    for (const sub of subscriptions) {
      statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1
    }

    if (Object.keys(statusCounts).length > 0) {
      console.log('\nBy status:')
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`  - ${status}: ${count}`)
      }
    }

    if (subscriptions.length > 0) {
      console.log('\nRecent subscriptions:')
      const recentSubs = subscriptions.slice(0, 3)
      for (const sub of recentSubs) {
        console.log(`  - ID: ${sub.id}`)
        console.log(`    Status: ${sub.status}`)
        console.log(`    Created: ${new Date(sub.created_at).toLocaleString()}`)
      }
    }
  }

  // =========================================================================
  // 6. List Transactions
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('TRANSACTIONS')
  console.log('='.repeat(50))
  const { data: transactions, error: txError } = await surpay.transactions.list(projectId)

  if (txError) {
    console.error('Failed to list transactions:', txError.message)
  } else {
    console.log(`Total transactions: ${transactions.length}`)

    // Calculate totals
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0)
    console.log(`Total revenue: $${(totalRevenue / 100).toFixed(2)}`)

    // Count by type
    const typeCounts: Record<string, number> = {}
    for (const tx of transactions) {
      typeCounts[tx.type] = (typeCounts[tx.type] || 0) + 1
    }

    if (Object.keys(typeCounts).length > 0) {
      console.log('\nBy type:')
      for (const [type, count] of Object.entries(typeCounts)) {
        console.log(`  - ${type}: ${count}`)
      }
    }

    if (transactions.length > 0) {
      console.log('\nRecent transactions:')
      const recentTx = transactions.slice(0, 5)
      for (const tx of recentTx) {
        console.log(`  - $${(tx.amount / 100).toFixed(2)} (${tx.type})`)
        console.log(`    ID: ${tx.id}`)
        console.log(`    Date: ${new Date(tx.created_at).toLocaleString()}`)
      }
    }
  }

  // =========================================================================
  // 7. List Prices
  // =========================================================================
  console.log('\n' + '='.repeat(50))
  console.log('PRICES (FULL LIST)')
  console.log('='.repeat(50))
  const { data: allProductsWithPrices, error: allPricesError } = await surpay.products.listWithPrices(projectId)

  if (allPricesError) {
    console.log(`Failed to list prices: ${allPricesError.message}`)
    if (createdThisSession.length > 0) {
      console.log('\nPrices created in this session:\n')
      for (const price of createdThisSession) {
        console.log(`  - ${price.name}`)
        console.log(`    Amount: $${(price.amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`)
        if (price.interval) {
          console.log(`    Interval: ${price.interval}`)
        }
        console.log(`    ID: ${price.id}`)
      }
    }
  } else {
    let totalPrices = 0
    for (const productWithPrices of allProductsWithPrices) {
      totalPrices += productWithPrices.prices.length
    }
    console.log(`Total prices: ${totalPrices}`)

    if (allProductsWithPrices.length > 0) {
      console.log('\nPrices:')
      for (const productWithPrices of allProductsWithPrices) {
        if (productWithPrices.prices.length > 0) {
          console.log(`  Product: ${productWithPrices.product.name}`)
          for (const price of productWithPrices.prices) {
            const amount = price.price_amount ?? 0
            const currency = price.price_currency?.toUpperCase() ?? 'USD'
            console.log(`    - ${price.name || 'Unnamed'}`)
            console.log(`      Amount: $${(amount / 100).toFixed(2)} ${currency}`)
            if (price.recurring_interval) {
              console.log(`      Interval: ${price.recurring_interval}`)
            }
            console.log(`      ID: ${price.id}`)
          }
        }
      }
    }

    if (createdThisSession.length > 0) {
      console.log('\nPrices created in this session:\n')
      for (const price of createdThisSession) {
        console.log(`  - ${price.name}`)
        console.log(`    Amount: $${(price.amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`)
        if (price.interval) {
          console.log(`      Interval: ${price.interval}`)
        }
        console.log(`    ID: ${price.id}`)
      }
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`Project ID: ${projectId}`)
  console.log(`Customers: ${customers?.length ?? 0}`)
  console.log(`Subscriptions: ${subscriptions?.length ?? 0}`)
  console.log(`Transactions: ${transactions?.length ?? 0}`)
  console.log(
    `Prices: ${allProductsWithPrices ? allProductsWithPrices.reduce((sum, p) => sum + p.prices.length, 0) : 0}`,
  )
  console.log(
    `Total Revenue: $${(transactions ? transactions.reduce((sum, t) => sum + t.amount, 0) / 100 : 0).toFixed(2)}`,
  )
  console.log('\nDone!')
}

main()
