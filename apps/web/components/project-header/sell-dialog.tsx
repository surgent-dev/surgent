'use client'

import { CircleNotch, Image as ImageIcon, Tag, UploadSimple, X } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { authClient } from '@/lib/auth-client'
import { payHttpLive } from '@/lib/http'
import { fileToDataUrl, uploadFile } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { useUpsertProjectListing } from '@/queries/marketplace'

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

const toggleTrack = 'inline-flex items-center rounded-2xl bg-black/[0.05] dark:bg-white/[0.06] p-1'
const toggleBtn = (active: boolean) =>
  cn(
    'px-4 py-2 rounded-[12px] text-sm font-semibold transition-all duration-300 ease-out',
    active
      ? 'bg-background text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)]'
      : 'text-muted-foreground hover:text-foreground',
  )

const field = cn(
  'flex h-12 w-full rounded-xl px-4 py-2 text-[14px]',
  'text-foreground placeholder:text-muted-foreground/40',
  'bg-black/[0.03] border border-black/[0.08] transition-all duration-150 outline-none',
  'hover:bg-black/[0.05] hover:border-black/[0.12]',
  'focus:bg-black/[0.05] focus:border-black/[0.16] focus:ring-2 focus:ring-black/[0.04]',
  'dark:bg-white/[0.04] dark:border-white/[0.08]',
  'dark:hover:bg-white/[0.06] dark:hover:border-white/[0.14]',
  'dark:focus:bg-white/[0.07] dark:focus:border-white/[0.18] dark:focus:ring-white/[0.06]',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive/50 aria-invalid:focus:ring-destructive/15',
)

export default function SellDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  sellerName,
  sellerImage,
  screenshotUrl,
}: SellDialogProps) {
  const [name, setName] = useState(projectName ?? '')
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
      toast.success('Payment account connected')
      setCompanyName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect', {})
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
    setName(projectName ?? '')
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
      toast.error('Please upload an image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }
    setImageCleared(false)
    setImagePreview(await fileToDataUrl(file))
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      setImageUrl(url)
    } catch {
      toast.error('Upload failed')
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

      toast.success(hasPaidPrice ? 'Listed for sale' : 'Listed on marketplace', {})
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create listing', {})
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
            <div className="px-8 pt-8 pb-6">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="size-9 rounded-xl bg-foreground flex items-center justify-center shadow-sm">
                  <Tag className="size-4.5 text-background" weight="fill" />
                </div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  List on marketplace
                </DialogTitle>
              </div>
              <DialogDescription className="text-[14px] text-muted-foreground/60 leading-relaxed ml-0.5">
                Create a premium listing for your project.
              </DialogDescription>
            </div>

            <div className="px-8 pb-8 space-y-7">
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
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground/80 ml-1">
                  Cover Image
                </label>
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
                      'flex flex-col items-center justify-center gap-2 aspect-[16/9] rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300',
                      dragging
                        ? 'border-foreground/20 bg-foreground/5'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted',
                    )}
                  >
                    <UploadSimple className="size-6 text-muted-foreground/30" weight="duotone" />
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[14px] font-medium text-muted-foreground">
                        Drop image or click to upload
                      </span>
                      <span className="text-[12px] text-muted-foreground/40">
                        16:9 ratio recommended
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative group rounded-2xl overflow-hidden border border-border/50 aspect-[16/9] shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Cover" className="w-full h-full object-cover" />
                    {uploading && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                        <CircleNotch className="size-5 animate-spin text-foreground/50" />
                      </div>
                    )}
                    {!uploading && (
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          type="button"
                          onClick={openFilePicker}
                          className="size-8 flex items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-sm hover:bg-background transition-colors"
                          title="Upload custom image"
                        >
                          <UploadSimple className="size-4" weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="size-8 flex items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-sm hover:bg-destructive hover:text-white transition-colors"
                          title="Remove image"
                        >
                          <X className="size-4" weight="bold" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground/80 ml-1">
                  Product Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AI Chat Template"
                  className={field}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-foreground/80 ml-1">
                  Description{' '}
                  <span className="font-normal text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's included in this listing..."
                  rows={3}
                  className={cn(field, 'h-auto py-3 resize-none')}
                />
              </div>

              {/* Pricing */}
              <div className="space-y-3 pt-2">
                <label className="text-[13px] font-semibold text-foreground/80 ml-1">Pricing</label>
                <div className={`${toggleTrack} w-full`}>
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
                  <div className="flex gap-2 pt-1">
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company name for Whop"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && companyName.trim()) handleConnect()
                      }}
                      className={field}
                    />
                    <Button
                      variant="brand"
                      size="lg"
                      className="h-12 px-6 shrink-0 rounded-2xl"
                      disabled={!companyName.trim() || connecting}
                      onClick={handleConnect}
                    >
                      {connecting ? (
                        <CircleNotch className="size-4 animate-spin" />
                      ) : (
                        'Connect Whop'
                      )}
                    </Button>
                  </div>
                )}

                {listingType === 'paid' && hasLiveAccount && (
                  <div className="flex gap-2 pt-1">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                        {currencySymbol}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className={cn(field, 'pl-8 font-bold tabular-nums text-lg')}
                      />
                    </div>
                    <div className={toggleTrack}>
                      {currencies.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setCurrency(c.value)}
                          className={cn(toggleBtn(currency === c.value), 'px-4')}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[12px] text-muted-foreground/60 ml-1">
                  {listingType === 'free'
                    ? 'Anyone can access your project for free.'
                    : !hasLiveAccount
                      ? 'Create a payment account to start selling securely.'
                      : 'Set a price and get paid instantly to your Whop account.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border/50 px-8 py-6 flex items-center gap-3 bg-muted/5 dark:bg-transparent">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 h-11 rounded-2xl font-semibold"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="brand"
                className="flex-1 h-11 rounded-2xl font-bold"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
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
          <div className="hidden lg:flex w-[24rem] border-l border-border/50 flex-col relative overflow-hidden bg-muted/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-foreground)_0%,transparent_40%)] opacity-[0.03]" />

            <div className="relative flex-1 flex flex-col items-center justify-center px-10 py-10">
              <div className="w-full mb-6">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 ml-1">
                  Live Preview
                </span>
              </div>

              <div
                className={cn(
                  'w-full rounded-[28px] bg-card overflow-hidden transition-all duration-500',
                  'border border-border/80 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.3)]',
                  'dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.05)]',
                  'group/preview hover:scale-[1.02] hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)] transition-all duration-300',
                )}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full aspect-[16/9] object-cover border-b border-border/50"
                  />
                ) : (
                  <div className="w-full aspect-[16/9] bg-muted/40 dark:bg-muted/20 flex items-center justify-center border-b border-border/50">
                    <ImageIcon className="size-8 text-muted-foreground/10" weight="duotone" />
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-lg font-bold truncate leading-tight tracking-tight text-foreground">
                      {name.trim() || (
                        <span className="text-muted-foreground/20 font-normal">Product Name</span>
                      )}
                    </h4>
                  </div>

                  <div className="min-h-[3rem]">
                    {(description.trim() || !name.trim()) && (
                      <p className="text-[13px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                        {description.trim() || (
                          <span className="text-muted-foreground/20 italic">
                            Product description goes here...
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div>
                      {hasPaidPrice ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/50">
                            Price
                          </span>
                          <span className="text-2xl font-black tabular-nums tracking-tighter text-foreground">
                            {currencySymbol}
                            {parseFloat(price).toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[12px] font-bold text-emerald-500 uppercase tracking-wide">
                            Free
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground/40 font-medium">
                          Build by
                        </span>
                        <span className="text-[13px] font-semibold text-foreground/80 truncate max-w-[80px]">
                          {sellerName || 'You'}
                        </span>
                      </div>
                      {sellerImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sellerImage}
                          alt=""
                          className="size-9 rounded-2xl object-cover ring-2 ring-background shadow-sm"
                        />
                      ) : (
                        <div className="size-9 rounded-2xl bg-muted dark:bg-foreground/[0.05] flex items-center justify-center ring-2 ring-background shadow-sm">
                          <span className="text-xs font-bold text-muted-foreground/60">
                            {(sellerName || 'Y')?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex flex-col items-center gap-2 opacity-30 group-hover/preview:opacity-60 transition-opacity duration-500">
                <div className="flex items-center gap-2">
                  <div className="h-[1px] w-8 bg-muted-foreground/30" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Marketplace View
                  </span>
                  <div className="h-[1px] w-8 bg-muted-foreground/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
