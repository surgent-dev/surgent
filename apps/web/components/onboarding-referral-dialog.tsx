'use client'

import { Copy, Gift } from '@phosphor-icons/react'
import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useReferralStats } from '@/hooks/use-referrals'
import { cn } from '@/lib/utils'

interface OnboardingReferralDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNext?: () => void
}

export default function OnboardingReferralDialog({
  open,
  onOpenChange,
  onNext,
}: OnboardingReferralDialogProps) {
  const { data } = useReferralStats()
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    if (!data?.link) return
    await navigator.clipboard.writeText(data.link)
    setCopied(true)
    toast.success('Referral link copied', { position: 'top-right' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNext = () => {
    onOpenChange(false)
    onNext?.()
  }

  const steps = [
    {
      label: 'Share your link',
      detail: 'Send your unique referral link to a friend',
      reward: null,
    },
    {
      label: 'They sign up',
      detail: 'Your friend creates an account',
      reward: `$${data?.signupRewardUsd ?? 2}`,
    },
    {
      label: 'They subscribe',
      detail: 'After their first paid charge',
      reward: `+$${data?.conversionRewardUsd ?? 3}`,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-border/50"
      >
        <DialogTitle className="sr-only">Invite friends to Surgent</DialogTitle>

        <div className="px-6 pt-6 pb-6">
          {/* Title */}
          <div className="text-center mb-6">
            <div className="size-10 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3">
              <Gift className="size-5 text-brand" weight="duotone" />
            </div>
            <h2 className="font-display text-2xl text-foreground">
              Invite friends, earn credits
              <span className="ml-2 inline-flex align-middle text-[12px] font-bold tabular-nums text-brand bg-brand/10 rounded-full px-2.5 py-1 -translate-y-0.5">
                +$3
              </span>
            </h2>
            <p className="text-sm text-muted-foreground/60 mt-1.5">
              Get rewarded when your friends join Surgent
            </p>
          </div>

          {/* Steps — vertical timeline */}
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/40 text-foreground/70 text-[13px] font-medium">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && <div className="w-px flex-1 bg-border/50 my-1" />}
                </div>
                {/* Content */}
                <div className={cn('pt-1.5', i < steps.length - 1 ? 'pb-6' : 'pb-0')}>
                  <div className="flex items-baseline gap-2.5">
                    <p className="text-[14px] font-medium">{step.label}</p>
                    {step.reward && (
                      <span className="text-[11px] font-bold tabular-nums text-brand bg-brand/10 rounded-full px-2 py-0.5">
                        {step.reward}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground/50 mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Link */}
          <div className="mt-6">
            <div className="flex items-center h-11 rounded-lg border border-border bg-muted/70 px-4">
              <span className="flex-1 min-w-0 truncate text-[13px] text-foreground/70 font-mono">
                {data?.link ?? '...'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={copyLink}
              className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-5 rounded-[0.5rem] text-sm font-medium cursor-pointer btn-brand-secondary transition-all duration-300"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-3.5" weight="bold" />
                  Copy link
                </>
              )}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[0.5rem] text-sm font-medium cursor-pointer btn-brand transition-all duration-300"
            >
              Continue
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
