'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Gift, X, ArrowRight } from 'lucide-react'
import { Ticket, CopySimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useSubscription } from '@/hooks/use-subscription'
import { toast } from 'react-hot-toast'

const COUPON_CODE = 'POIUYTR50'
const DISMISS_KEY = 'migration-banner-dismissed'
const DIALOG_SHOWN_KEY = 'migration-dialog-shown'

export default function MigrationCreditBanner({
  onUpgrade,
  showDialog,
}: {
  onUpgrade: () => void
  showDialog?: boolean
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY) === '1'
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const dialogTriggered = useRef(false)
  const { data: snapshot } = useSubscription()

  // TODO: restore condition after testing
  const visible = !dismissed
  // const visible =
  //   !dismissed &&
  //   snapshot?.hasMigrationCredit &&
  //   snapshot.prepaidBalanceMicros > 0

  // Auto-open dialog once per user (first visit only)
  useEffect(() => {
    if (!showDialog || !visible || dialogTriggered.current) return
    if (typeof window !== 'undefined' && localStorage.getItem(DIALOG_SHOWN_KEY) === '1') return
    dialogTriggered.current = true
    localStorage.setItem(DIALOG_SHOWN_KEY, '1')
    setDialogOpen(true)
  }, [showDialog, visible])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }, [])

  const openOffer = useCallback(() => {
    setDialogOpen(true)
  }, [])

  if (!visible) return null

  const copyCoupon = () => {
    navigator.clipboard.writeText(COUPON_CODE)
    toast.success('Coupon code copied!', { position: 'top-right' })
  }

  return (
    <>
      {/* Banner */}
      <div className="border-b border-violet-500/15 bg-violet-500/[0.04]">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Gift className="h-4 w-4 text-violet-500 shrink-0" />
            <p className="text-xs sm:text-sm text-foreground">
              <span className="font-medium">
                Your previous subscription has been canceled &mdash; we&apos;ve upgraded our
                billing.
              </span>{' '}
              You&apos;ve been rewarded <span className="font-semibold">$25 in credits</span> + an
              exclusive 50% off coupon.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={openOffer}>
              Claim Offer
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-muted/80 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-[400px] gap-0 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Billing migration</DialogTitle>

          {/* Header */}
          <div className="px-6 pt-7 pb-3 text-center">
            <h2 className="text-[17px] font-semibold tracking-tight">
              We&apos;ve upgraded our billing
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Your old subscription was canceled. As one of our first 30 customers, here&apos;s what
              we set aside just for you.
            </p>
          </div>

          {/* Rewards */}
          <div className="mx-5 rounded-lg border border-border/60 overflow-hidden">
            {/* $25 credit */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Gift className="h-4 w-4 text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">$25 in AI credits</p>
                <p className="text-[11px] text-muted-foreground">
                  Deducted per request &middot; stacks on any plan
                </p>
              </div>
              <span className="text-base font-bold shrink-0">$25</span>
            </div>

            <div className="border-t border-dashed border-border/60" />

            {/* Coupon */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="h-4 w-4 text-violet-500 shrink-0" weight="fill" />
                  <div>
                    <p className="text-[13px] font-medium">50% off first month</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={copyCoupon}
                        className="inline-flex items-center gap-1.5 rounded bg-muted hover:bg-muted/70 transition-colors px-2 py-0.5 group"
                      >
                        <span className="font-mono text-[12px] font-semibold tracking-wide">
                          {COUPON_CODE}
                        </span>
                        <CopySimple
                          className="h-3 w-3 text-muted-foreground group-hover:text-foreground"
                          weight="bold"
                        />
                      </button>
                      <span className="text-[10px] text-muted-foreground/50">Use at checkout</span>
                    </div>
                  </div>
                </div>
                <span className="text-base font-bold text-violet-500 shrink-0">&minus;50%</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pt-4 pb-6 flex flex-col gap-2">
            <Button
              className="w-full h-10 text-sm font-medium"
              onClick={() => {
                copyCoupon()
                setDialogOpen(false)
                onUpgrade()
              }}
            >
              Copy Code & Upgrade
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <p className="text-[11px] text-center text-muted-foreground/50">
              Paste the promo code at checkout to get 50% off
            </p>
            <button
              onClick={() => setDialogOpen(false)}
              className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
