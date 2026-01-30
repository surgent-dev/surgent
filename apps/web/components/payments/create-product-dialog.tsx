'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { useCreateProduct } from '@/queries/products'

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

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited.current) {
      setValue('slug', toSlug(name))
    }
  }, [name, setValue])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset()
      slugManuallyEdited.current = false
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
          toast.success('Product created successfully')
          onOpenChange(false)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Product</DialogTitle>
          <DialogDescription>Add a new product to your catalog</DialogDescription>
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
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="e.g. pro-plan"
              aria-invalid={!!errors.slug}
              {...register('slug', {
                onChange: () => {
                  slugManuallyEdited.current = true
                },
              })}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create Product
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
