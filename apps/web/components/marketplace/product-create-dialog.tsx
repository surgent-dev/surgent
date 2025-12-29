'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateProduct, useUpdateProduct } from '@/queries/marketplace'
import { toast } from 'react-hot-toast'
import { Loader2, CheckCircle2, ImagePlus, X } from 'lucide-react'
import { uploadFile, fileToDataUrl } from '@/lib/upload'
import { cn } from '@/lib/utils'

const productSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  previewUrl: z.string().url().optional().or(z.literal('')),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  amount: z.string().min(1).refine((v) => parseFloat(v) > 0, 'Must be positive'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
})

type ProductForm = z.infer<typeof productSchema>

interface ProductPrice {
  id: string
  code: string
  amount: number
  currency: string
}

interface ProductMetadata {
  previewUrl?: string
  thumbnailUrl?: string
}

interface ExistingProduct {
  id: string
  title: string
  slug: string
  description?: string
  status: string
  metadata?: ProductMetadata | null
  prices?: ProductPrice[]
}

interface ProductCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  projectId: string
  defaultTitle?: string
  existingProduct?: ExistingProduct | null
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function ProductCreateDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  defaultTitle,
  existingProduct,
}: ProductCreateDialogProps) {
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isEditMode = Boolean(existingProduct)

  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const dragCounter = useRef(0)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { isValid, isDirty },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      previewUrl: '',
      thumbnailUrl: '',
      amount: '',
      currency: 'USD',
    },
    mode: 'onChange',
  })

  const title = watch('title')
  const currency = watch('currency')
  const thumbnailUrl = watch('thumbnailUrl')

  // Auto-generate slug from title (only in create mode)
  useEffect(() => {
    if (!isEditMode && title) {
      setValue('slug', slugify(title))
    }
  }, [title, isEditMode, setValue])

  // Image upload handlers
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setIsUploading(true)
    try {
      const preview = await fileToDataUrl(file)
      setImagePreview(preview)
      const { url } = await uploadFile(file)
      setValue('thumbnailUrl', url, { shouldDirty: true })
    } catch {
      toast.error('Failed to upload image')
      setImagePreview(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageUpload(file)
  }

  const removeImage = () => {
    setImagePreview(null)
    setValue('thumbnailUrl', '', { shouldDirty: true })
  }

  // Document-level paste listener for reliable paste support
  useEffect(() => {
    if (!open) return

    const handlePaste = (e: ClipboardEvent) => {
      // Only handle if drop zone is focused or no input is focused
      const active = document.activeElement
      const isInputFocused = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA'
      if (isInputFocused && active !== dropZoneRef.current) return

      const file = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        handleImageUpload(file)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [open])

  // Populate form when dialog opens
  useEffect(() => {
    if (!open) return

    if (existingProduct) {
      const thumb = existingProduct.metadata?.thumbnailUrl ?? ''
      reset({
        title: existingProduct.title,
        slug: existingProduct.slug,
        description: existingProduct.description ?? '',
        previewUrl: existingProduct.metadata?.previewUrl ?? '',
        thumbnailUrl: thumb,
        amount: existingProduct.prices?.[0]?.amount?.toString() ?? '',
        currency: (existingProduct.prices?.[0]?.currency as 'USD' | 'EUR' | 'GBP') ?? 'USD',
      })
      setImagePreview(thumb || null)
    } else {
      reset({
        title: defaultTitle ?? '',
        slug: defaultTitle ? slugify(defaultTitle) : '',
        description: '',
        previewUrl: '',
        thumbnailUrl: '',
        amount: '',
        currency: 'USD',
      })
      setImagePreview(null)
    }
  }, [existingProduct, defaultTitle, open, reset])

  const onSubmit = async (data: ProductForm) => {
    try {
      if (isEditMode && existingProduct) {
        await updateProduct.mutateAsync({
          productId: existingProduct.id,
          title: data.title.trim(),
          description: data.description?.trim() || undefined,
          previewUrl: data.previewUrl?.trim() || null,
          thumbnailUrl: data.thumbnailUrl?.trim() || null,
        })
        toast.success('Product updated!')
      } else {
        await createProduct.mutateAsync({
          projectId,
          title: data.title.trim(),
          slug: data.slug.trim(),
          description: data.description?.trim() || undefined,
          previewUrl: data.previewUrl?.trim() || undefined,
          thumbnailUrl: data.thumbnailUrl?.trim() || undefined,
          price: { code: 'default', amount: parseFloat(data.amount), currency: data.currency },
        })
        toast.success('Product listed!')
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save product')
    }
  }

  const isPending = createProduct.isPending || updateProduct.isPending
  const price = existingProduct?.prices?.[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">
              {isEditMode ? 'Edit Product' : 'List Product'}
            </DialogTitle>
            {isEditMode && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" />
                Active
              </span>
            )}
          </div>
          <DialogDescription>
            {isEditMode ? 'Update your product details.' : 'Set up your product to sell.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">Title</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Product name"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-xs">Slug</Label>
            <Input
              id="slug"
              {...register('slug')}
              placeholder="product-slug"
              className="h-9 font-mono text-xs"
              disabled={isEditMode}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Describe your product..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Cover Image <span className="text-muted-foreground">(optional)</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              ref={dropZoneRef}
              tabIndex={0}
              role="button"
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && !isUploading && fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                "relative h-28 rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                isDragging ? "border-brand bg-brand/5" : "border-muted-foreground/20 hover:border-muted-foreground/40",
                isUploading && "pointer-events-none opacity-60"
              )}
            >
              {imagePreview || thumbnailUrl ? (
                <>
                  <img
                    src={imagePreview || thumbnailUrl}
                    alt="Cover"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage() }}
                    className="absolute top-1.5 right-1.5 size-6 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <div className="size-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                  {isUploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="size-5" />
                      <span className="text-xs">Click, drop, or paste</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="previewUrl" className="text-xs">
              Preview URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="previewUrl"
              type="url"
              {...register('previewUrl')}
              placeholder="https://example.com/preview"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {currencySymbols[currency]}
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register('amount')}
                  placeholder="9.99"
                  className="h-9 pl-7"
                  disabled={isEditMode}
                />
              </div>
              {isEditMode && price && (
                <p className="text-xs text-muted-foreground">
                  Current: {currencySymbols[price.currency]}{price.amount}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-xs">Currency</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEditMode}>
                    <SelectTrigger id="currency" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={isEditMode ? !isDirty || isPending : !isValid || isPending}
            >
              {isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'List Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

