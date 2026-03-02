'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Tag, UploadSimple, X, CircleNotch, Image as ImageIcon } from '@phosphor-icons/react'
import { toast } from 'react-hot-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { payHttpLive } from '@/lib/http'
import { authClient } from '@/lib/auth-client'
import { useUpsertProjectListing } from '@/queries/marketplace'
import { uploadFile, fileToDataUrl } from '@/lib/upload'

interface SellDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  projectName?: string
  sellerName?: string
  sellerImage?: string
  screenshotUrl?: string | null
}

const currencies = [
  { value: 'usd', label: 'USD', symbol: '$' },
  { value: 'eur', label: 'EUR', symbol: '€' },
  { value: 'gbp', label: 'GBP', symbol: '£' },
] as const

function nameToSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

const toggleTrack =
  'inline-flex items-center rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner'
const toggleBtn = (active: boolean) =>
  cn(
    'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-out',
    active
      ? 'bg-background dark:bg-muted text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  )

const field =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border-hover focus:border-foreground/80'

export default function SellDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  sellerName,
  sellerImage,
  screenshotUrl,
}: SellDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [listingType, setListingType] = useState<'free' | 'paid'>('free')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<'usd' | 'eur' | 'gbp'>('usd')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [imageCleared, setImageCleared] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const upsertListing = useUpsertProjectListing()
  const queryClient = useQueryClient()

  const { data: liveAccounts } = useQuery({
    queryKey: ['surpay-accounts', 'live'],
    queryFn: () => payHttpLive.get('accounts').json<{ id: string }[]>(),
    enabled: open,
    staleTime: 30_000,
  })
  const hasLiveAccount = (liveAccounts?.length ?? 0) > 0

  const [companyName, setCompanyName] = useState('')
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    if (!companyName.trim()) return
    setConnecting(true)
    try {
      const { data } = await authClient.getSession()
      await payHttpLive
        .post('accounts/connect/whop', {
          json: { email: data?.user?.email, title: companyName.trim(), country: 'us' },
        })
        .json()
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts'] })
      toast.success('Payment account connected', { position: 'top-right' })
      setCompanyName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect', {
        position: 'top-right',
      })
    } finally {
      setConnecting(false)
    }
  }

  const [submitting, setSubmitting] = useState(false)
  const hasPaidPrice = listingType === 'paid' && price && parseFloat(price) > 0
  const canSubmit =
    name.trim() &&
    !submitting &&
    !uploading &&
    (listingType === 'free' || (price && parseFloat(price) > 0 && hasLiveAccount))

  const currencySymbol = currencies.find((c) => c.value === currency)?.symbol || '$'

  // Use deployment screenshot as default when dialog opens
  useEffect(() => {
    if (open && screenshotUrl && !imagePreview && !imageUrl && !imageCleared) {
      setImagePreview(screenshotUrl)
      setImageUrl(screenshotUrl)
    }
  }, [open, screenshotUrl, imagePreview, imageUrl, imageCleared])

  const resetForm = () => {
    setName('')
    setDescription('')
    setListingType('free')
    setPrice('')
    setCurrency('usd')
    setImagePreview(null)
    setImageUrl(null)
    setImageCleared(false)
    setCompanyName('')
  }

  const handleImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image', { position: 'top-right' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB', { position: 'top-right' })
      return
    }
    setImageCleared(false)
    setImagePreview(await fileToDataUrl(file))
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      setImageUrl(url)
    } catch {
      toast.error('Upload failed', { position: 'top-right' })
      setImagePreview(null)
      setImageUrl(null)
    } finally {
      setUploading(false)
    }
  }, [])

  const handleSubmit = async () => {
    if (!projectId || !canSubmit) return
    const trimmedName = name.trim()
    const trimmedDesc = description.trim() || `${trimmedName} — built on Surgent`

    setSubmitting(true)
    try {
      let productId: string | undefined
      let priceId: string | undefined

      if (hasPaidPrice) {
        const slug = nameToSlug(trimmedName)
        const product = await payHttpLive
          .post('product', {
            searchParams: { projectId },
            json: { productGroup: slug, name: trimmedName, slug, description: trimmedDesc },
          })
          .json<{ productId: string; productGroup: string }>()

        const priceResult = await payHttpLive
          .post('product/price', {
            searchParams: { projectId },
            json: {
              productGroup: product.productGroup,
              price: Math.round(parseFloat(price) * 100),
              priceCurrency: currency,
            },
          })
          .json<{ productPriceId: string }>()

        productId = product.productId
        priceId = priceResult.productPriceId
      }

      await upsertListing.mutateAsync({
        projectId,
        title: trimmedName,
        description: trimmedDesc,
        imageUrl: imageUrl || undefined,
        productId,
        priceId,
      })

      toast.success(hasPaidPrice ? 'Listed for sale' : 'Listed on marketplace', {
        position: 'top-right',
      })
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create listing', {
        position: 'top-right',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openFilePicker = () => fileRef.current?.click()
  const clearImage = () => {
    setImagePreview(null)
    setImageUrl(null)
    setImageCleared(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) resetForm()
      }}
    >
      <DialogContent
        overlayClassName="backdrop-blur-sm"
        className="sm:max-w-[52rem] gap-0 p-0 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row">
          {/* ── Left: Form ── */}
          <div className="flex-1 min-w-0">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="size-8 rounded-lg bg-foreground flex items-center justify-center">
                  <Tag className="size-4 text-background" weight="fill" />
                </div>
                <DialogTitle className="text-base font-semibold tracking-tight">
                  List on marketplace
                </DialogTitle>
              </div>
              <DialogDescription className="text-[13px] text-muted-foreground/70 leading-relaxed">
                Create a listing for your project on the marketplace.
              </DialogDescription>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* Hidden file input — single instance */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImage(f)
                }}
              />

              {/* Cover image */}
              {!imagePreview ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleImage(file)
                  }}
                  onClick={openFilePicker}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 aspect-[16/9] rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                    dragging
                      ? 'border-foreground/40 bg-muted/40'
                      : 'border-border hover:border-muted-foreground/40',
                  )}
                >
                  <UploadSimple className="size-5 text-muted-foreground/40" weight="duotone" />
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[13px] font-medium text-muted-foreground">
                      Drop image or click to upload
                    </span>
                    <span className="text-[11px] text-muted-foreground/40">
                      This will be your listing cover image
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative group rounded-lg overflow-hidden border aspect-[16/9]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Cover" className="w-full h-full object-cover" />
                  {uploading && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <CircleNotch className="size-4 animate-spin" />
                    </div>
                  )}
                  {!uploading && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="p-1 rounded-md bg-background/80 hover:bg-background"
                        title="Upload custom image"
                      >
                        <UploadSimple className="size-3" weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="p-1 rounded-md bg-background/80 hover:bg-background"
                        title="Remove image"
                      >
                        <X className="size-3" weight="bold" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AI Chat Template"
                  className={field}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's included..."
                  rows={2}
                  className={cn(field, 'h-auto py-2.5 resize-none')}
                />
              </div>

              {/* Pricing */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Pricing</label>
                <div className={toggleTrack + ' w-full'}>
                  <button
                    type="button"
                    onClick={() => {
                      setListingType('free')
                      setPrice('')
                    }}
                    className={cn(toggleBtn(listingType === 'free'), 'flex-1 text-center')}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingType('paid')}
                    className={cn(toggleBtn(listingType === 'paid'), 'flex-1 text-center')}
                  >
                    One-time price
                  </button>
                </div>

                {listingType === 'paid' && !hasLiveAccount && (
                  <div className="flex gap-2">
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company name"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && companyName.trim()) handleConnect()
                      }}
                      className={field}
                    />
                    <Button
                      size="sm"
                      className="h-10 px-4 shrink-0"
                      disabled={!companyName.trim() || connecting}
                      onClick={handleConnect}
                    >
                      {connecting ? <CircleNotch className="size-3.5 animate-spin" /> : 'Connect'}
                    </Button>
                  </div>
                )}

                {listingType === 'paid' && hasLiveAccount && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                        {currencySymbol}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className={cn(field, 'pl-7 font-medium tabular-nums')}
                      />
                    </div>
                    <div className={toggleTrack}>
                      {currencies.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setCurrency(c.value)}
                          className={toggleBtn(currency === c.value)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground/50">
                  {listingType === 'free'
                    ? 'Anyone can access your project for free.'
                    : !hasLiveAccount
                      ? 'Create a payment account to start selling.'
                      : 'Buyers pay once to get access to your project.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-9"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1 h-9" disabled={!canSubmit} onClick={handleSubmit}>
                {submitting ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : listingType === 'paid' ? (
                  'List for sale'
                ) : (
                  'List for free'
                )}
              </Button>
            </div>
          </div>

          {/* ── Right: Live Preview ── */}
          <div className="hidden sm:flex w-[22rem] border-l flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-muted/25 dark:bg-muted/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-background)_0%,transparent_70%)]" />

            <div className="relative flex-1 flex flex-col items-center justify-center px-8 py-10">
              <div
                className={cn(
                  'w-full max-w-[16rem] rounded-2xl bg-card overflow-hidden transition-all duration-500',
                  'border border-border/50',
                  'shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.06)]',
                  'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.2),0_12px_40px_rgba(0,0,0,0.3)]',
                )}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full aspect-[16/9] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[16/9] bg-muted/40 dark:bg-muted/20 flex items-center justify-center">
                    <ImageIcon className="size-6 text-muted-foreground/15" weight="duotone" />
                  </div>
                )}

                <div className="p-4">
                  <h4 className="text-sm font-semibold truncate leading-snug">
                    {name.trim() || (
                      <span className="text-muted-foreground/20 font-normal">Product name</span>
                    )}
                  </h4>

                  {(description.trim() || !name.trim()) && (
                    <p className="text-xs text-muted-foreground/50 mt-1 line-clamp-2 leading-relaxed">
                      {description.trim() || (
                        <span className="text-muted-foreground/15">Add a description...</span>
                      )}
                    </p>
                  )}

                  <div className="mt-3.5">
                    {hasPaidPrice ? (
                      <span className="text-base font-bold tabular-nums tracking-tight">
                        {currencySymbol}
                        {parseFloat(price).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-emerald-600">Free</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-border/30">
                    {sellerImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sellerImage}
                        alt=""
                        className="size-5 rounded-full object-cover ring-1 ring-border/50"
                      />
                    ) : (
                      <div className="size-5 rounded-full bg-foreground/[0.06] dark:bg-foreground/[0.1] flex items-center justify-center">
                        <span className="text-[9px] font-medium text-muted-foreground/60">
                          {(sellerName || 'Y')?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground/40 truncate">
                      {sellerName || 'You'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
