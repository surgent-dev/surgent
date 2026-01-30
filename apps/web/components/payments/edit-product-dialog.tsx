'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateProduct, useArchiveProduct, type Product } from '@/queries/products'

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
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const updateProduct = useUpdateProduct(projectId)
  const archiveProduct = useArchiveProduct(projectId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product.name,
      description: product.description ?? '',
    },
  })

  // Reset form when product changes or dialog opens
  useEffect(() => {
    reset({
      name: product.name,
      description: product.description ?? '',
    })
  }, [product, reset])

  // Reset archive confirm when dialog closes
  useEffect(() => {
    if (!open) {
      setShowArchiveConfirm(false)
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
          toast.success('Product updated successfully')
          onOpenChange(false)
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
        toast.success('Product archived successfully')
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to archive product')
      },
    })
  }

  // Archive confirmation dialog
  if (showArchiveConfirm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Product?</DialogTitle>
            <DialogDescription>
              This will hide the product from your catalog. Existing subscriptions won&apos;t be
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setShowArchiveConfirm(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveProduct.isPending}
            >
              {archiveProduct.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Pro Plan"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe your product..."
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button type="button" variant="destructive" onClick={() => setShowArchiveConfirm(true)}>
              Archive
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProduct.isPending}>
                {updateProduct.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
