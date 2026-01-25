/**
 * Surpay SDK - Admin Usage Example
 *
 * Demonstrates organization-level operations with the admin client.
 * Run with: bun examples/admin-usage.ts
 */

import { SurpayAdmin, Surpay } from '../src/index.js'

async function main() {
  // Admin operations (master key required)
  const env = typeof process !== 'undefined' ? process.env : {}
  const admin = new SurpayAdmin({
    masterKey: env.SURPAY_MASTER_KEY ?? 'sp_master_test_key_123',
    baseUrl: env.SURPAY_BASE_URL ?? 'http://localhost:8090',
  })

  // Create a new organization
  const { data: org, error: orgError } = await admin.organization.create({
    name: 'Tenant A',
    slug: 'tenant-a',
  })

  if (orgError) {
    console.error('Failed to create organization:', orgError.message, orgError.code)
    process.exit(1)
  }

  console.log('Created organization:', org.id)
  console.log('Organization API key:', org.api_key)

  // Now use the org key for tenant operations
  const surpay = new Surpay({
    apiKey: org.api_key,
    baseUrl: env.SURPAY_BASE_URL ?? 'http://localhost:8090',
  })

  // Tenant operations... (requires a project ID)
  // Note: In practice, you would need to create a project first
  // For now, this demonstrates the API signature
  // const { data: products, error: productsError } = await surpay.products.listWithPrices(projectId);

  // Create a project for demonstration
  const { data: project, error: projectError } = await surpay.projects.create({
    name: 'Demo Project',
    slug: 'demo-project',
  })

  if (projectError) {
    console.error('Failed to create project:', projectError.message)
    process.exit(1)
  }

  const { data: products, error: productsError } = await surpay.products.listWithPrices(project.id)

  if (productsError) {
    console.error('Failed to list products:', productsError.message)
    process.exit(1)
  }

  console.log('Products:', products.length)
}

main()
