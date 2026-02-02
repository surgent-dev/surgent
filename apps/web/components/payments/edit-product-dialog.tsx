'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Archive, Check, Loader2, Settings } from 'lucide-react'
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
import { useUpdateProduct, useArchiveProduct, type Product } from '@/queries/products'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type EditProductDialogProps = {
  projectId: string
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProductDialog({
  projectId,
  product,
  open,
  onOpenChange,
}: EditProductDialogProps) {
  const [view, setView] = useState<'edit' | 'archive-confirm' | 'success'>('edit')
  const updateProduct = useUpdateProduct(projectId)
  const archiveProduct = useArchiveProduct(projectId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product.name,
      description: product.description ?? '',
    },
  })

  useEffect(() => {
    reset({
      name: product.name,
      description: product.description ?? '',
    })
  }, [product, reset])

  useEffect(() => {
    if (!open) {
      setView('edit')
    }
  }, [open])

  const onSubmit = (data: FormData) => {
    updateProduct.mutate(
      {
        productId: product.id,
        input: {
          name: data.name,
          description: data.description || undefined,
        },
      },
      {
        onSuccess: () => {
          setView('success')
          setTimeout(() => {
            onOpenChange(false)
          }, 1200)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update product')
        },
      },
    )
  }

  const handleArchive = () => {
    archiveProduct.mutate(product.id, {
      onSuccess: () => {
        toast.success('Product archived')
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to archive product')
      },
    })
  }

  if (view === 'success') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="rounded-full bg-success/10 p-4 mb-4">
              <Check className="size-8 text-success" strokeWidth={2.5} />
            </div>
            <h3 className="font-semibold text-lg mb-1">Product Updated!</h3>
            <p className="text-sm text-muted-foreground">Your changes have been saved</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (view === 'archive-confirm') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center py-4">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <AlertTriangle className="size-8 text-destructive" strokeWidth={2} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Archive "{product.name}"?</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              This will hide the product from your catalog. Existing subscriptions won&apos;t be
              affected.
            </p>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setView('edit')}
                disabled={archiveProduct.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleArchive}
                disabled={archiveProduct.isPending}
              >
                {archiveProduct.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="size-4 mr-2" />
                    Archive
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-lg bg-muted p-2">
              <Settings className="size-5 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle className="text-lg">Edit Product</DialogTitle>
              <DialogDescription className="text-xs">Update product details</DialogDescription>
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
              placeholder="e.g. Pro Plan"
              aria-invalid={!!errors.name}
              className={cn('h-10', errors.name && 'border-destructive')}
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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

          {/* Slug (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">URL Slug</Label>
            <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm text-muted-foreground font-mono">
              {product.slug}
            </div>
            <p className="text-xs text-muted-foreground">Slugs cannot be changed after creation</p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <button
              type="button"
              onClick={() => setView('archive-confirm')}
              className="text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              Archive product
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProduct.isPending || !isDirty}>
                {updateProduct.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
