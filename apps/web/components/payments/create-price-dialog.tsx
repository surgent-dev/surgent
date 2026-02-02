'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreatePrice, type ProductPrice } from '@/queries/products'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().optional(),
  price: z
    .string()
    .min(1, 'Price is required')
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      'Must be a valid positive number',
    ),
  priceCurrency: z.enum(['usd', 'eur', 'gbp']),
  recurringInterval: z.enum(['day', 'week', 'month', 'year']).optional(),
})

type FormData = z.infer<typeof schema>

type CreatePriceDialogProps = {
  projectId: string
  productGroup: string
  productName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  existingPrices?: ProductPrice[]
}

type PricingType = 'one-time' | 'subscription' | 'none'

function getPricingType(prices: ProductPrice[]): PricingType {
  if (prices.length === 0) return 'none'
  const hasSubscription = prices.some((p) => p.recurringInterval)
  return hasSubscription ? 'subscription' : 'one-time'
}

const currencies = [
  { value: 'usd', label: 'USD', symbol: '$' },
  { value: 'eur', label: 'EUR', symbol: '€' },
  { value: 'gbp', label: 'GBP', symbol: '£' },
] as const

const intervals = [
  { value: 'month', label: 'Monthly', description: 'Billed every month' },
  { value: 'year', label: 'Yearly', description: 'Billed once a year' },
  { value: 'week', label: 'Weekly', description: 'Billed every week' },
  { value: 'day', label: 'Daily', description: 'Billed every day' },
] as const

export function CreatePriceDialog({
  projectId,
  productGroup,
  productName,
  open,
  onOpenChange,
  existingPrices = [],
}: CreatePriceDialogProps) {
  const pricingType = getPricingType(existingPrices)
  const createPrice = useCreatePrice(projectId)
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [isRecurring, setIsRecurring] = useState(pricingType !== 'one-time')

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      price: '',
      priceCurrency: 'usd',
      recurringInterval: undefined,
    },
  })

  const selectedCurrency = watch('priceCurrency')

  useEffect(() => {
    if (!open) {
      reset()
      setStep('form')
      setIsRecurring(pricingType !== 'one-time')
    }
  }, [open, reset, pricingType])

  useEffect(() => {
    if (isRecurring) {
      setValue('recurringInterval', 'month')
    } else {
      setValue('recurringInterval', undefined)
    }
  }, [isRecurring, setValue])

  const onSubmit = (data: FormData) => {
    const cents = Math.round(parseFloat(data.price) * 100)

    createPrice.mutate(
      {
        productGroup,
        price: cents,
        priceCurrency: data.priceCurrency,
        name: data.name || undefined,
        recurringInterval: isRecurring ? data.recurringInterval : undefined,
      },
      {
        onSuccess: () => {
          setStep('success')
          setTimeout(() => {
            onOpenChange(false)
          }, 1500)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create price')
        },
      },
    )
  }

  const currencySymbol = currencies.find((c) => c.value === selectedCurrency)?.symbol || '$'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {step === 'success' ? (
          <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="rounded-full bg-success/10 p-4 mb-4">
              <Check className="size-8 text-success" strokeWidth={2.5} />
            </div>
            <h3 className="font-semibold text-lg mb-1">Price Added!</h3>
            <p className="text-sm text-muted-foreground">Your product is ready to sell</p>
          </div>
        ) : (
          <>
            <DialogHeader className="pb-0">
              <DialogTitle>Add Pricing</DialogTitle>
              <DialogDescription className="text-sm">
                Set the price for {productName}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
              {/* Price Type Toggle */}
              {pricingType === 'none' && (
                <div className="inline-flex items-center rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setIsRecurring(false)}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-out',
                      !isRecurring
                        ? 'bg-background dark:bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(true)}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-out',
                      isRecurring
                        ? 'bg-background dark:bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Subscription
                  </button>
                </div>
              )}

              {/* Price Input */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Price</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      {currencySymbol}
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={!!errors.price}
                      className={cn(
                        'h-10 pl-7 font-medium tabular-nums',
                        errors.price && 'border-destructive',
                      )}
                      {...register('price')}
                    />
                  </div>
                  <Controller
                    name="priceCurrency"
                    control={control}
                    render={({ field }) => (
                      <div className="inline-flex items-center rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner">
                        {currencies.map((currency) => (
                          <button
                            key={currency.value}
                            type="button"
                            onClick={() => field.onChange(currency.value)}
                            className={cn(
                              'px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-out',
                              field.value === currency.value
                                ? 'bg-background dark:bg-muted text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {currency.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>

              {/* Billing Interval */}
              {isRecurring && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Billing Cycle</Label>
                  <Controller
                    name="recurringInterval"
                    control={control}
                    render={({ field }) => (
                      <div className="inline-flex items-center rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner">
                        {intervals.map((interval) => (
                          <button
                            key={interval.value}
                            type="button"
                            onClick={() => field.onChange(interval.value)}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-out',
                              field.value === interval.value
                                ? 'bg-background dark:bg-muted text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {interval.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
              )}

              {/* Price Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="name"
                  placeholder={isRecurring ? 'e.g. Monthly, Annual' : 'e.g. Standard, Premium'}
                  className="h-10"
                  {...register('name')}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-9"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createPrice.isPending} className="flex-1 h-9">
                  {createPrice.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Add Price'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
