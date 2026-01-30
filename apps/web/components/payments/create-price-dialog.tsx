'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreatePrice, type ProductPrice } from '@/queries/products'

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

  const {
    register,
    handleSubmit,
    reset,
    control,
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

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const onSubmit = (data: FormData) => {
    const cents = Math.round(parseFloat(data.price) * 100)

    createPrice.mutate(
      {
        productGroup,
        price: cents,
        priceCurrency: data.priceCurrency,
        name: data.name || undefined,
        recurringInterval: data.recurringInterval,
      },
      {
        onSuccess: () => {
          toast.success('Price created successfully')
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create price')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Price to {productName}</DialogTitle>
          <DialogDescription>Configure pricing for this product</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="name" placeholder="e.g. Monthly" {...register('name')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="text"
              inputMode="decimal"
              placeholder="9.99"
              aria-invalid={!!errors.price}
              {...register('price')}
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Controller
              name="priceCurrency"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                    <SelectItem value="gbp">GBP</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Billing Interval</Label>
            <Controller
              name="recurringInterval"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? 'one-time'}
                  onValueChange={(val) => field.onChange(val === 'one-time' ? undefined : val)}
                >
                  <SelectTrigger id="interval" className="w-full">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingType !== 'subscription' && (
                      <SelectItem value="one-time">One-time</SelectItem>
                    )}
                    {pricingType !== 'one-time' && (
                      <>
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {pricingType === 'subscription' && (
              <p className="text-xs text-muted-foreground">
                This product already has subscription pricing
              </p>
            )}
            {pricingType === 'one-time' && (
              <p className="text-xs text-muted-foreground">
                This product already has one-time pricing
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPrice.isPending}>
              {createPrice.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Add Price
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
