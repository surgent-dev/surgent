'use client'

import { useCheckoutEmbedControls, WhopCheckoutEmbed } from '@whop/checkout/react'
import type { WhopCheckoutState } from '@whop/checkout/util'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { formatPrice } from '@/components/payments/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { track } from '@/lib/track'
import { useCheckoutSession } from '@/queries/checkout'

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()

  const { data: session, isLoading, error } = useCheckoutSession(id)

  const checkoutRef = useCheckoutEmbedControls()

  const [embedState, setEmbedState] = useState<WhopCheckoutState>('loading')
  const [completed, setCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const title = session?.title || 'Payment'
  const amount = session?.amount ?? null
  const currency = session?.currency || 'usd'
  const planType = session?.planType || 'one_time'
  const sessionId = session?.sessionId
  const purchaseTrackedRef = useRef(false)

  // Handle return from external payment providers (e.g. PayPal)
  const returnStatus = searchParams.get('status')
  useEffect(() => {
    if (returnStatus === 'success') {
      setCompleted(true)
      if (!purchaseTrackedRef.current) {
        purchaseTrackedRef.current = true
        track('purchase', {
          transaction_id: id,
          value: amount ? amount / 100 : 0,
          currency: currency.toUpperCase(),
          items: [{ item_id: id, item_name: title }],
        })
      }
    }
  }, [returnStatus, id, amount, currency, title])

  const formattedPrice = amount !== null ? formatPrice(amount, currency) : null

  const handleSubmit = useCallback(async () => {
    if (!checkoutRef.current) return
    setSubmitting(true)
    try {
      await checkoutRef.current.submit()
    } catch {
      // embed handles errors internally
    } finally {
      setSubmitting(false)
    }
  }, [checkoutRef])

  const handleComplete = useCallback(() => {
    setCompleted(true)
    if (!purchaseTrackedRef.current) {
      purchaseTrackedRef.current = true
      track('purchase', {
        transaction_id: id,
        value: amount ? amount / 100 : 0,
        currency: currency.toUpperCase(),
        items: [{ item_id: id, item_name: title }],
      })
    }
  }, [id, amount, currency, title])

  const handleStateChange = useCallback((s: WhopCheckoutState) => {
    setEmbedState(s)
  }, [])

  const handleNavigate = useCallback(() => {
    if (session?.redirectUrl) {
      window.location.href = session.redirectUrl
      return
    }
    window.close()
  }, [session?.redirectUrl])

  if (isLoading) {
    return <CheckoutSkeleton />
  }

  if (error || !session) {
    return (
      <StatusScreen icon={AlertCircle} iconClass="text-destructive">
        <h2 className="text-xl font-semibold mb-2">Checkout not found</h2>
        <p className="text-sm text-muted-foreground mb-8">
          This checkout session may have expired or is invalid.
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-2" />
          Go back
        </Button>
      </StatusScreen>
    )
  }

  if (session.status === 'creating') {
    return (
      <StatusScreen icon={Loader2} iconClass="text-muted-foreground animate-spin">
        <h2 className="text-xl font-semibold mb-2">Setting up checkout</h2>
        <p className="text-sm text-muted-foreground">
          Please wait while we prepare your payment...
        </p>
      </StatusScreen>
    )
  }

  if (completed || session.status === 'completed') {
    return (
      <StatusScreen icon={Check} iconClass="text-emerald-500" iconBg="bg-emerald-500/10">
        <h2 className="text-xl font-semibold mb-2">Payment successful</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Your payment has been processed successfully.
        </p>
        <Button onClick={handleNavigate}>Done</Button>
      </StatusScreen>
    )
  }

  if (session.status === 'failed') {
    return (
      <StatusScreen icon={AlertCircle} iconClass="text-destructive" iconBg="bg-destructive/10">
        <h2 className="text-xl font-semibold mb-2">Payment failed</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Something went wrong with this payment. Please try again.
        </p>
        <Button variant="outline" onClick={handleNavigate}>
          <ArrowLeft className="size-4 mr-2" />
          Go back
        </Button>
      </StatusScreen>
    )
  }

  if (session.status === 'pending') {
    return (
      <StatusScreen icon={Clock} iconClass="text-muted-foreground">
        <h2 className="text-xl font-semibold mb-2">Payment processing</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Your payment is being processed. This may take a moment.
        </p>
        <Button variant="outline" onClick={handleNavigate}>
          Done
        </Button>
      </StatusScreen>
    )
  }

  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const isSubscription = planType === 'renewal'

  return (
    <div className="h-dvh bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto flex h-full w-full max-w-[1180px]">
        <div className="hidden md:flex w-[430px] shrink-0 border-r bg-muted/20 flex-col justify-between p-8">
          <div>
            <button
              onClick={handleNavigate}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>

            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 pb-5 border-b">
                <div className="size-10 rounded-xl border bg-muted/30 grid place-items-center overflow-hidden">
                  <Image src="/surpay-coin.svg" alt="Surgent" width={28} height={28} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Surgent Pay</p>
                  <p className="text-xs text-muted-foreground">Secure checkout</p>
                </div>
              </div>

              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-5 mb-2">
                {isSubscription ? 'Subscription' : 'One-time payment'}
              </p>
              <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
              {formattedPrice && (
                <p className="text-3xl font-bold tabular-nums mt-4">
                  {formattedPrice}
                  {isSubscription && (
                    <span className="text-base font-normal text-muted-foreground"> / month</span>
                  )}
                </p>
              )}

              <div className="mt-8 rounded-xl border bg-muted/20 p-4 space-y-3">
                <SummaryRow label={title} value={formattedPrice} />
                <div className="h-px bg-border" />
                <SummaryRow label="Total" value={formattedPrice} bold />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            <span>Payments are secure and encrypted</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 px-4 py-4 md:px-8 md:py-8">
          <div className="md:hidden flex items-center justify-between pb-4">
            <button
              onClick={handleNavigate}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg border bg-muted/40 grid place-items-center overflow-hidden">
                <Image src="/surpay-coin.svg" alt="Surgent" width={18} height={18} />
              </div>
              <p className="text-sm font-medium">Surgent Pay</p>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[560px] flex-1">
            <div className="w-full rounded-2xl border bg-card shadow-sm p-5 md:p-6 flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Payment details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your secure checkout
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Lock className="size-3" />
                  Encrypted
                </div>
              </div>

              {formattedPrice && (
                <div className="md:hidden mt-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <SummaryRow label={title} value={formattedPrice} />
                </div>
              )}

              <div className="mt-5 flex-1 min-h-0">
                {sessionId ? (
                  <div className="relative rounded-xl border bg-background p-3 md:p-4 min-h-[260px]">
                    {embedState === 'loading' && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/70 rounded-xl">
                        <Loader2 className="size-5 text-muted-foreground animate-spin" />
                      </div>
                    )}
                    <WhopCheckoutEmbed
                      ref={checkoutRef}
                      sessionId={sessionId}
                      theme={theme}
                      environment={session?.env === 'live' ? 'production' : 'sandbox'}
                      returnUrl={typeof window !== 'undefined' ? window.location.href : undefined}
                      hidePrice
                      hideTermsAndConditions
                      hideSubmitButton
                      skipRedirect
                      onComplete={handleComplete}
                      onStateChange={handleStateChange}
                      styles={{ container: { paddingY: 0 } }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[220px] text-sm text-muted-foreground rounded-xl border bg-muted/20">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Loading payment form...
                  </div>
                )}
              </div>

              <div className="pt-5 mt-5 border-t">
                <Button
                  className="w-full h-11 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-all duration-100"
                  disabled={!sessionId || embedState !== 'ready' || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-3.5 mr-2" />
                      Pay{formattedPrice ? ` ${formattedPrice}` : ''}
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground mt-3">
                  By confirming your payment, you agree to the terms of service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusScreen({
  children,
  icon: Icon,
  iconClass,
  iconBg = 'bg-muted',
}: {
  children: React.ReactNode
  icon: React.ElementType
  iconClass?: string
  iconBg?: string
}) {
  return (
    <div className="h-dvh flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-sm w-full text-center rounded-2xl border bg-card p-8 shadow-sm">
        <div className="size-10 rounded-lg border bg-muted/30 grid place-items-center mx-auto mb-4 overflow-hidden">
          <Image src="/surpay-coin.svg" alt="Surgent" width={24} height={24} />
        </div>
        <div
          className={`size-14 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-5 border`}
        >
          <Icon className={`size-6 ${iconClass}`} />
        </div>
        {children}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string | null
  bold?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? 'font-semibold text-sm' : 'text-sm'}`}
    >
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value ?? '-'}</span>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="h-dvh bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto flex h-full w-full max-w-[1180px]">
        <div className="hidden md:flex w-[430px] shrink-0 border-r bg-muted/20 p-8">
          <div className="w-full rounded-2xl border bg-card p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
        <div className="flex-1 px-4 py-4 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[560px] rounded-2xl border bg-card p-5 md:p-6 space-y-4">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
