/**
 * Surpay SDK
 *
 * Official TypeScript/JavaScript SDK for the Surpay payment platform.
 *
 * @example
 * ```typescript
 * import { Surpay } from 'surpay'
 *
 * const surpay = new Surpay({ apiKey: 'xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd' })
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

// Main client
export { Surpay } from './surpay.js'

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

  // Enums
  SubscriptionStatus,
  RecurringInterval,
  TransactionType,
  CheckoutStatus,
  CheckoutMode,
  PayoutStatus,

  // Project
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
