'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Loader2, Package, Sparkles } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useCreateProduct } from '@/queries/products'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric with hyphens only'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const toSlug = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

type CreateProductDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProductDialog({ projectId, open, onOpenChange }: CreateProductDialogProps) {
  const slugManuallyEdited = useRef(false)
  const createProduct = useCreateProduct(projectId)
  const [step, setStep] = useState<'form' | 'success'>('form')

  const {
    register,
    handleSubmit,
    reset,
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
    },
  })

  const name = watch('name')
  const slug = watch('slug')

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
    }
  }, [open, reset])

  const onSubmit = async (data: FormData) => {
    createProduct.mutate(
      {
        productGroup: data.slug,
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
      },
      {
        onSuccess: () => {
          setStep('success')
          setTimeout(() => {
            onOpenChange(false)
          }, 1500)
        },
        onError: (error) => {
          if (error.message?.includes('slug already exists')) {
            setError('slug', { message: 'This slug is already taken' })
            return
          }
          toast.error(error.message || 'Failed to create product')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {step === 'success' ? (
          <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="rounded-full bg-success/10 p-4 mb-4">
              <Check className="size-8 text-success" strokeWidth={2.5} />
            </div>
            <h3 className="font-semibold text-lg mb-1">Product Created!</h3>
            <p className="text-sm text-muted-foreground">Now add pricing to start selling</p>
          </div>
        ) : (
          <>
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="rounded-lg bg-brand/10 p-2">
                  <Package className="size-5 text-brand" />
                </div>
                <div>
                  <DialogTitle className="text-lg">New Product</DialogTitle>
                  <DialogDescription className="text-xs">
                    Create a product to start accepting payments
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  Product Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Pro Plan, Premium Access"
                  aria-invalid={!!errors.name}
                  className={cn('h-10', errors.name && 'border-destructive')}
                  {...register('name')}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-sm font-medium">
                  URL Slug
                </Label>
                <div className="relative">
                  <Input
                    id="slug"
                    placeholder="pro-plan"
                    aria-invalid={!!errors.slug}
                    className={cn('h-10 font-mono text-sm', errors.slug && 'border-destructive')}
                    {...register('slug', {
                      onChange: () => {
                        slugManuallyEdited.current = true
                      },
                    })}
                  />
                </div>
                {errors.slug ? (
                  <p className="text-xs text-destructive">{errors.slug.message}</p>
                ) : slug ? (
                  <p className="text-xs text-muted-foreground">
                    checkout/product/<span className="font-medium text-foreground">{slug}</span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of what's included..."
                  rows={3}
                  className="resize-none"
                  {...register('description')}
                />
              </div>

              <div className="flex gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProduct.isPending} className="flex-1">
                  {createProduct.isPending ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      Create Product
                    </>
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
