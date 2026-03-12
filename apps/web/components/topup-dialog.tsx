'use client'

import { useRef, useState } from 'react'
import { Check, CircleNotch } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTopupPaymentIntent, useSubscription } from '@/hooks/use-subscription'

const PRESETS = [10, 20, 50, 100]

interface TopupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatAmount(amount: number) {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2)
}

export default function TopupDialog({ open, onOpenChange }: TopupDialogProps) {
  const { data } = useSubscription()
  const createIntent = useTopupPaymentIntent()
  const [selected, setSelected] = useState(20)
  const [customValue, setCustomValue] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const minUsd = data?.topupMinUsd ?? 10
  const amount = isCustom ? parseFloat(customValue) || 0 : selected
  const isValid = amount >= minUsd
  const tooLow = isCustom && customValue !== '' && amount > 0 && amount < minUsd
  const brand = data?.paymentMethodBrand
  const last4 = data?.paymentMethodLast4

  const reset = () => {
    setSelected(20)
    setCustomValue('')
    setIsCustom(false)
    setSuccess(false)
    setError(null)
  }

  const handleDialogChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleContinue = async () => {
    if (!isValid) return

    try {
      setError(null)
      const next = await createIntent.mutateAsync({ amountUsd: amount })
      if (next.mode === 'charged') {
        handleSuccess()
        return
      }
      if (next.error) setError(next.error)
      window.location.href = next.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment')
    }
  }

  const handleSuccess = () => {
    setSuccess(true)
    setTimeout(() => {
      reset()
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[420px] gap-0 p-0 overflow-hidden border-border/50">
        <DialogTitle className="sr-only">Add balance</DialogTitle>

        <div className="px-8 pt-8 text-center">
          <h2 className="text-[22px] font-bold tracking-tight">Add balance</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Top up your usage balance</p>
        </div>

        {success ? (
          <div className="px-6 pt-8 pb-8">
            <div className="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Check weight="bold" className="size-5" />
              </div>
              <p className="mt-3 text-[15px] font-semibold">Balance added</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 pt-6">
              <div className="grid grid-cols-4 gap-2.5">
                {PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelected(value)
                      setIsCustom(false)
                      setCustomValue('')
                    }}
                    className={cn(
                      'cursor-pointer relative rounded-2xl py-5 text-center transition-all duration-150 active:scale-[0.97]',
                      !isCustom && selected === value
                        ? 'ring-[1.5px] ring-brand bg-brand/5 shadow-[0_0_12px_rgba(124,58,237,0.08)]'
                        : 'border border-border/50 hover:border-border hover:bg-muted/30',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[22px] font-bold tabular-nums leading-none tracking-tight',
                        !isCustom && selected === value
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      ${value}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 pt-3">
              <div
                onClick={() => {
                  setIsCustom(true)
                  setTimeout(() => inputRef.current?.focus(), 0)
                }}
                className={cn(
                  'cursor-text flex items-center h-11 rounded-xl border px-4 transition-all duration-150',
                  isCustom
                    ? 'border-brand/40 bg-brand/[0.03] shadow-[0_0_12px_rgba(124,58,237,0.06)]'
                    : 'border-border/50 hover:border-border/80',
                )}
              >
                <span className="text-[14px] font-semibold text-muted-foreground/50 mr-2 select-none">
                  $
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={customValue}
                  onChange={(e) => {
                    setCustomValue(e.target.value.replace(/[^0-9.]/g, ''))
                    setIsCustom(true)
                  }}
                  onFocus={() => setIsCustom(true)}
                  onBlur={() => {
                    if (!customValue) setIsCustom(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValid) void handleContinue()
                  }}
                  placeholder="Custom amount"
                  className="flex-1 bg-transparent outline-none text-[14px] font-medium tabular-nums min-w-0 placeholder:text-muted-foreground/30"
                />
              </div>
              {tooLow && (
                <p className="mt-1.5 text-[11px] text-destructive px-1">Minimum ${minUsd}</p>
              )}
            </div>

            <div className="px-6 pt-6 pb-6">
              <Button
                className="w-full h-11 rounded-xl text-[14px] font-semibold cursor-pointer shadow-[0_0_24px_rgba(124,58,237,0.2)] hover:shadow-[0_0_32px_rgba(124,58,237,0.3)] transition-shadow duration-300"
                variant="brand"
                disabled={!isValid || createIntent.isPending}
                onClick={handleContinue}
              >
                {createIntent.isPending ? (
                  <CircleNotch weight="bold" className="size-4 animate-spin" />
                ) : last4 ? (
                  `Add $${formatAmount(amount)} instantly`
                ) : (
                  `Continue with $${formatAmount(amount)}`
                )}
              </Button>
              {last4 && (
                <p className="mt-2.5 text-center text-[11px] text-muted-foreground/50">
                  Charging {brand ?? 'card'} ending in {last4}
                </p>
              )}
              {error && <p className="mt-2 text-center text-[12px] text-destructive">{error}</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
