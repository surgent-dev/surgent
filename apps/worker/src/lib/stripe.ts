import Stripe from 'stripe'
import { config } from './config'

export const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, {
      apiVersion: '2026-02-25.clover',
      maxNetworkRetries: 2,
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null
