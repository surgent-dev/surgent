'use client'

import { CheckCircle, Copy, CurrencyDollar, Users } from '@phosphor-icons/react'
import { X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useReferralStats } from '@/hooks/use-referrals'

interface ReferralDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ReferralDialog({ open, onOpenChange }: ReferralDialogProps) {
  const { data } = useReferralStats()

  const copyLink = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.link)
    toast.success('Referral link copied', { position: 'top-right' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-border/50"
      >
        <div className="h-11 px-4 flex items-center justify-between border-b bg-muted/30">
          <DialogTitle className="text-sm font-medium">Refer friends</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 pt-6 pb-5">
          <div className="text-center">
            <h2 className="text-[22px] font-bold tracking-tight">Invite friends</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Simple referral rewards, paid as credits.
            </p>
          </div>

          <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-2">
            <div className="bg-background px-4 py-4 text-left sm:text-center">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                1. Signup
              </div>
              <div className="mt-2 text-[22px] font-semibold leading-none tabular-nums text-sky-700 dark:text-sky-300">
                ${data?.signupRewardUsd ?? 2}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                when they create an account
              </div>
            </div>
            <div className="bg-background px-4 py-4 text-left sm:text-center">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                2. First payment
              </div>
              <div className="mt-2 text-[22px] font-semibold leading-none tabular-nums text-emerald-700 dark:text-emerald-300">
                +${data?.conversionRewardUsd ?? 3}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                after their first paid charge
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5">
          <div
            onClick={copyLink}
            className="group cursor-pointer flex items-start rounded-xl border border-border/60 hover:border-border px-4 py-3 transition-colors"
          >
            <span className="flex-1 min-w-0 break-all text-[12px] leading-5 text-muted-foreground font-mono pr-3">
              {data?.link ?? '...'}
            </span>
            <Copy
              className="size-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0 mt-0.5"
              weight="duotone"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 pb-6">
          <div className="rounded-xl border border-border/60 bg-background px-4 py-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-full bg-sky-500/[0.12]">
                <Users weight="duotone" className="size-3.5 text-sky-600 dark:text-sky-400" />
              </span>
              Signups
            </div>
            <div className="mt-2 text-[24px] font-semibold leading-none tabular-nums">
              {data?.signups ?? 0}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background px-4 py-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/[0.12]">
                <CheckCircle
                  weight="duotone"
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                />
              </span>
              Converted
            </div>
            <div className="mt-2 text-[24px] font-semibold leading-none tabular-nums">
              {data?.converted ?? 0}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background px-4 py-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/[0.12]">
                <CurrencyDollar
                  weight="duotone"
                  className="size-3.5 text-amber-600 dark:text-amber-400"
                />
              </span>
              Earned
            </div>
            <div className="mt-2 text-[24px] font-semibold leading-none tabular-nums">
              ${data?.earnedUsd ?? 0}
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/20 px-6 py-5">
          <Button
            className="w-full h-11 rounded-xl text-[13px] font-medium cursor-pointer"
            variant="outline"
            onClick={copyLink}
          >
            <Copy className="size-3.5" weight="duotone" />
            Copy referral link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
