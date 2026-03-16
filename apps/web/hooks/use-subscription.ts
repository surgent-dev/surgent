'use client'

import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'

export type BillingTier = 'free' | 'pro'
export type BillingInterval = 'month' | 'year' | null

export type BillingSnapshot = {
  organizationId: string
  stripeCustomerId: string | null
  tier: BillingTier
  interval: BillingInterval
  status: string
  trialEnd: string | null
  currentPeriodEnd: string | null
  nextResetAt: string | null
  cancelAtPeriodEnd: boolean
  includedRemainingMicros: number
  prepaidBalanceMicros: number
  totalBalanceMicros: number
  totalBudgetMicros: number
  usedMicros: number
  usedPercent: number
  monthlyAllowanceMicros: number
  monthlySpendLimitMicros: number
  paymentMethodBrand: string | null
  paymentMethodLast4: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  hasMigrationCredit: boolean
  founderCouponCode: string | null
  topupMinUsd: number
  features: {
    projectsLimit: number | null
    privateProjects: boolean
    publishYourApp: boolean
    downloadCode: boolean
    canUseAi: boolean
  }
  billingOptions: Array<{
    tier: BillingTier
    label: string
    interval: BillingInterval
    priceUsd: number
    priceLabel: string
    monthlyAllowanceMicros: number
    monthlyAllowanceLabel: string
  }>
}

export type BillingSyncKind = 'subscription' | 'topup' | null

export type BillingSyncResult = {
  snapshot: BillingSnapshot
  kind: BillingSyncKind
}

export type TopupPaymentIntentCollectResult = {
  mode: 'checkout'
  url: string
  error?: string | null
}

export type TopupPaymentIntentChargedResult = {
  mode: 'charged'
  snapshot: BillingSnapshot
}

export type TopupPaymentIntentResult =
  | TopupPaymentIntentCollectResult
  | TopupPaymentIntentChargedResult

export const billingSubscriptionQueryKey = ['billing', 'subscription'] as const

export async function fetchSubscription() {
  return http.get('api/billing/subscription').json<BillingSnapshot>()
}

function getReturnPath() {
  if (typeof window === 'undefined') return '/dashboard'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function useSubscription() {
  return useQuery({
    queryKey: billingSubscriptionQueryKey,
    queryFn: () => fetchSubscription(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useBillingSync() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId?: string | null) => {
      return http
        .post('api/billing/sync', {
          json: sessionId ? { sessionId } : {},
        })
        .json<BillingSyncResult>()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(billingSubscriptionQueryKey, data.snapshot)
    },
  })
}

export function useBillingCheckout() {
  const inflight = useRef<Promise<string> | null>(null)

  return useMutation({
    mutationFn: async (args: { interval: Exclude<BillingInterval, null>; returnPath?: string }) => {
      if (inflight.current) return inflight.current

      const request = http
        .post('api/billing/checkout', {
          json: {
            interval: args.interval,
            requestId: crypto.randomUUID(),
            returnPath: args.returnPath ?? getReturnPath(),
          },
        })
        .json<{ url: string }>()
        .then((data) => data.url)
        .finally(() => {
          inflight.current = null
        })

      inflight.current = request
      return request
    },
  })
}

export function useTopupPaymentIntent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: { amountUsd: number; returnPath?: string }) => {
      return http
        .post('api/billing/topups/payment-intent', {
          json: {
            amountUsd: args.amountUsd,
            requestId: crypto.randomUUID(),
            returnPath: args.returnPath ?? getReturnPath(),
          },
        })
        .json<TopupPaymentIntentResult>()
    },
    onSuccess: (data) => {
      if (data.mode !== 'charged') return
      queryClient.setQueryData(billingSubscriptionQueryKey, data.snapshot)
    },
  })
}

export function useGenerateFounderCoupon() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return http.post('api/billing/founder-coupon').json<{ code: string }>()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(billingSubscriptionQueryKey, (prev: BillingSnapshot | undefined) =>
        prev ? { ...prev, founderCouponCode: data.code } : prev,
      )
    },
  })
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async (returnPath?: string) => {
      const data = await http
        .post('api/billing/portal', {
          json: { returnPath: returnPath ?? getReturnPath() },
        })
        .json<{ url: string }>()
      return data.url
    },
  })
}
