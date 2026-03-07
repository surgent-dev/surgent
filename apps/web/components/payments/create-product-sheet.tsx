'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateProduct, useCreatePrice } from '@/queries/products'
import { cn } from '@/lib/utils'

const currencies = [
  { value: 'usd', label: 'USD', symbol: '$' },
  { value: 'eur', label: 'EUR', symbol: '€' },
  { value: 'gbp', label: 'GBP', symbol: '£' },
] as const

const intervals = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'week', label: 'Weekly' },
] as const

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric with hyphens only'),
  description: z.string().optional(),
  price: z
    .string()
    .min(1, 'Price is required')
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      'Must be a valid positive number',
    ),
  priceCurrency: z.enum(['usd', 'eur', 'gbp']),
  recurringInterval: z.enum(['week', 'month', 'year']).optional(),
})

type FormData = z.infer<typeof schema>

const toSlug = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

type CreateProductSheetProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProductSheet({ projectId, open, onOpenChange }: CreateProductSheetProps) {
  const slugManuallyEdited = useRef(false)
  const createProduct = useCreateProduct(projectId)
  const createPrice = useCreatePrice(projectId)
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [isRecurring, setIsRecurring] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      price: '',
      priceCurrency: 'usd',
      recurringInterval: undefined,
    },
  })

  const name = watch('name')
  const slug = watch('slug')
  const selectedCurrency = watch('priceCurrency')

  useEffect(() => {
    if (!slugManuallyEdited.current) {
      setValue('slug', toSlug(name))
    }
  }, [name, setValue])

  useEffect(() => {
    if (!open) {
      reset()
      slugManuallyEdited.current = false
      setStep('form')
      setIsRecurring(false)
      setSubmitting(false)
    }
  }, [open, reset])

  useEffect(() => {
    if (isRecurring) {
      setValue('recurringInterval', 'month')
    } else {
      setValue('recurringInterval', undefined)
    }
  }, [isRecurring, setValue])

  const currencySymbol = currencies.find((c) => c.value === selectedCurrency)?.symbol || '$'

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    let productCreated = false
    try {
      const product = await createProduct.mutateAsync({
        productGroup: data.slug,
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
      })
      productCreated = true

      const cents = Math.round(parseFloat(data.price) * 100)
      await createPrice.mutateAsync({
        productGroup: product.productGroup,
        price: cents,
        priceCurrency: data.priceCurrency,
        recurringInterval: isRecurring ? data.recurringInterval : undefined,
      })

      setStep('success')
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create product'
      if (productCreated) {
        toast.error(
          'Product created but pricing failed. You can add pricing from the product card.',
        )
        onOpenChange(false)
      } else if (message.includes('slug already exists')) {
        setError('slug', { message: 'This slug is already taken' })
      } else {
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v)
      }}
    >
      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
            <div className="rounded-full bg-success/10 p-3.5 mb-3">
              <Check className="size-7 text-success" strokeWidth={2.5} />
            </div>
            <h3 className="font-semibold text-base mb-1">Product Created!</h3>
            <p className="text-sm text-muted-foreground">Your product is ready to sell</p>
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <SheetTitle className="text-left">New Product</SheetTitle>
              <SheetDescription>Create a product with pricing to start selling</SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <form
                id="create-product-form"
                onSubmit={handleSubmit(onSubmit)}
                className="p-5 space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">
                    Product Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Pro Plan, Premium Access"
                    aria-invalid={!!errors.name}
                    className={cn(errors.name && 'border-destructive')}
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive mt-2">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-sm">
                    URL Slug
                  </Label>
                  <Input
                    id="slug"
                    placeholder="pro-plan"
                    aria-invalid={!!errors.slug}
                    className={cn('font-mono text-sm', errors.slug && 'border-destructive')}
                    {...register('slug', {
                      onChange: () => {
                        slugManuallyEdited.current = true
                      },
                    })}
                  />
                  {errors.slug ? (
                    <p className="text-xs text-destructive mt-2">{errors.slug.message}</p>
                  ) : slug ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      checkout/product/
                      <span className="font-medium text-foreground">{slug}</span>
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm">
                    Description{' '}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="A brief description of what's included..."
                    rows={2}
                    className="resize-none"
                    {...register('description')}
                  />
                </div>

                <div className="h-px bg-border -mx-5" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Pricing</Label>
                    <div className="inline-flex items-center rounded-[14px] bg-black/10 p-1 border border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                      <button
                        type="button"
                        onClick={() => setIsRecurring(false)}
                        className={cn(
                          'px-3 py-1 rounded-[10px] text-sm font-medium transition-all duration-200 ease-out',
                          !isRecurring
                            ? 'bg-foreground/10 text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        One-time
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRecurring(true)}
                        className={cn(
                          'px-3 py-1 rounded-[10px] text-sm font-medium transition-all duration-200 ease-out',
                          isRecurring
                            ? 'bg-foreground/10 text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Subscription
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Price</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          {currencySymbol}
                        </span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-invalid={!!errors.price}
                          className={cn(
                            'pl-7 font-medium tabular-nums',
                            errors.price && 'border-destructive',
                          )}
                          {...register('price')}
                        />
                      </div>
                      <Controller
                        name="priceCurrency"
                        control={control}
                        render={({ field }) => (
                          <div className="inline-flex items-center rounded-[14px] bg-black/10 p-1 border border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                            {currencies.map((currency) => (
                              <button
                                key={currency.value}
                                type="button"
                                onClick={() => field.onChange(currency.value)}
                                className={cn(
                                  'px-2.5 py-1 rounded-[10px] text-sm font-medium transition-all duration-200 ease-out',
                                  field.value === currency.value
                                    ? 'bg-foreground/10 text-foreground shadow-sm'
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
                    {errors.price && (
                      <p className="text-xs text-destructive mt-2">{errors.price.message}</p>
                    )}
                  </div>

                  {isRecurring && (
                    <div className="space-y-2">
                      <Label className="text-sm">Billing Cycle</Label>
                      <Controller
                        name="recurringInterval"
                        control={control}
                        render={({ field }) => (
                          <div className="inline-flex items-center rounded-[14px] bg-black/10 p-1 border border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                            {intervals.map((interval) => (
                              <button
                                key={interval.value}
                                type="button"
                                onClick={() => field.onChange(interval.value)}
                                className={cn(
                                  'px-3 py-1 rounded-[10px] text-sm font-medium transition-all duration-200 ease-out',
                                  field.value === interval.value
                                    ? 'bg-foreground/10 text-foreground shadow-sm'
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
                </div>
              </form>
            </ScrollArea>

            <div className="px-6 py-4 border-t shrink-0 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-product-form"
                size="lg"
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : 'Create Product'}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
