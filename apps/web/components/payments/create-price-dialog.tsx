'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, DollarSign, Loader2, RefreshCw, Zap } from 'lucide-react'
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
  const selectedInterval = watch('recurringInterval')
  const priceValue = watch('price')

  useEffect(() => {
    if (!open) {
      reset()
      setStep('form')
      setIsRecurring(pricingType !== 'one-time')
    }
  }, [open, reset, pricingType])

  useEffect(() => {
    if (isRecurring && !selectedInterval) {
      setValue('recurringInterval', 'month')
    } else if (!isRecurring) {
      setValue('recurringInterval', undefined)
    }
  }, [isRecurring, selectedInterval, setValue])

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
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="rounded-lg bg-brand/10 p-2">
                  <DollarSign className="size-5 text-brand" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Add Pricing</DialogTitle>
                  <DialogDescription className="text-xs">
                    Set the price for {productName}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
              {/* Price Type Toggle */}
              {pricingType === 'none' && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsRecurring(false)}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                      !isRecurring
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Zap className="size-4" />
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(true)}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                      isRecurring
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <RefreshCw className="size-4" />
                    Subscription
                  </button>
                </div>
              )}

              {/* Price Input */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Price</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">
                      {currencySymbol}
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={!!errors.price}
                      className={cn(
                        'h-12 pl-8 text-lg font-semibold tabular-nums',
                        errors.price && 'border-destructive',
                      )}
                      {...register('price')}
                    />
                  </div>
                  <Controller
                    name="priceCurrency"
                    control={control}
                    render={({ field }) => (
                      <div className="flex rounded-lg border bg-background overflow-hidden">
                        {currencies.map((currency) => (
                          <button
                            key={currency.value}
                            type="button"
                            onClick={() => field.onChange(currency.value)}
                            className={cn(
                              'px-3 py-2 text-sm font-medium transition-colors',
                              field.value === currency.value
                                ? 'bg-brand text-brand-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
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
                      <div className="grid grid-cols-2 gap-2">
                        {intervals.map((interval) => (
                          <button
                            key={interval.value}
                            type="button"
                            onClick={() => field.onChange(interval.value)}
                            className={cn(
                              'flex flex-col items-start p-3 rounded-lg border transition-all text-left',
                              field.value === interval.value
                                ? 'border-brand bg-brand/5 ring-1 ring-brand'
                                : 'hover:border-border/80 hover:bg-muted/30',
                            )}
                          >
                            <span
                              className={cn(
                                'text-sm font-medium',
                                field.value === interval.value ? 'text-brand' : 'text-foreground',
                              )}
                            >
                              {interval.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {interval.description}
                            </span>
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
                  Price Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="name"
                  placeholder={isRecurring ? 'e.g. Monthly, Annual' : 'e.g. Standard, Premium'}
                  className="h-10"
                  {...register('name')}
                />
              </div>

              {/* Preview */}
              {priceValue && (
                <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
                  <p className="text-xs text-muted-foreground mb-1">Preview</p>
                  <p className="text-lg font-semibold">
                    {currencySymbol}
                    {parseFloat(priceValue || '0').toFixed(2)}
                    {isRecurring && selectedInterval && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /
                        {selectedInterval === 'month'
                          ? 'mo'
                          : selectedInterval === 'year'
                            ? 'yr'
                            : selectedInterval}
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createPrice.isPending} className="flex-1">
                  {createPrice.isPending ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Adding...
                    </>
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
