/**
 * Surpay SDK
 *
 * Official TypeScript/JavaScript SDK for the Surpay payment platform.
 *
 * @example
 * ```typescript
 * import { Surpay } from 'surpay'
 *
 * const surpay = new Surpay({ apiKey: 'sp_org_xxx' })
 *
 * // Create a checkout session
 * const { data, error } = await surpay.checkout.create({
 *   product_id: 'prod_xxx',
 *   price_id: 'price_xxx',
 *   success_url: 'https://myapp.com/success',
 *   cancel_url: 'https://myapp.com/cancel',
 * })
 *
 * if (error) {
 *   console.error(error.message, error.code)
 *   return
 * }
 *
 * // Redirect user to checkout
 * console.log(data.checkout_url)
 * ```
 */

// Main clients
export { Surpay } from './surpay.js'
export { SurpayAdmin } from './surpay-admin.js'

// Error handling
export { SurpayError, isSurpayError } from './errors.js'

// All types
export type {
  // Result pattern
  Result,
  Success,
  Failure,

  // Config
  SurpayConfig,
  SurpayAdminConfig,

  // Enums
  SubscriptionStatus,
  RecurringInterval,
  TransactionType,
  CheckoutStatus,
  CheckoutMode,

  // Organization
  CreateOrganizationRequest,
  CreateOrganizationResponse,

  // Project
  CreateProjectRequest,
  CreateProjectResponse,
  Project,

  // Customer
  Customer,
  CustomerWithDetails,
  TransactionSummary,
  SubscriptionSummary,

  // Product
  Product,
  CreateProductRequest,
  CreateProductResponse,
  UpdateProductRequest,
  UpdateProductResponse,
  ProductWithPrices,

  // Price
  ProductPrice,
  CreatePriceRequest,
  CreatePriceResponse,

  // Checkout
  CreateCheckoutRequest,
  CreateCheckoutResponse,

  // Transaction
  Transaction,

  // Subscription
  Subscription,

  // Accounts
  ConnectAccountRequest,
  ConnectAccountResponse,
  ConnectedAccount,
} from './types.js'
