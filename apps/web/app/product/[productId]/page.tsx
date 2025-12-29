'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'react-hot-toast'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ArrowLeft, ExternalLink, Loader2, Store, ShoppingBag } from 'lucide-react'
import { useCheckout } from '@/queries/marketplace'
import { http } from '@/lib/http'

interface ProductMetadata {
  previewUrl?: string
  thumbnailUrl?: string
}

interface ProductPrice {
  id: string
  amount: number
  currency: string
}

interface Product {
  id: string
  title: string
  slug: string
  description?: string
  metadata?: ProductMetadata | null
  merchantName: string
  prices?: ProductPrice[]
}

function formatPrice(amount: number | string, currency: string) {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `${symbols[currency] || currency}${num.toFixed(2)}`
}

async function fetchProduct(id: string): Promise<Product | null> {
  try {
    return await http.get(`api/marketplace/products/${id}`).json<Product>()
  } catch {
    return null
  }
}

export default function ProductPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const checkoutMutation = useCheckout()

  useEffect(() => {
    authClient.getSession().then(({ data, error }) => {
      if (!error && data?.user) setIsAuthenticated(true)
    })
  }, [])

  useEffect(() => {
    if (!productId) return
    setIsLoading(true)
    fetchProduct(productId)
      .then(setProduct)
      .finally(() => setIsLoading(false))
  }, [productId])

  const handleBuy = async () => {
    if (!product) return

    if (!isAuthenticated) {
      router.push(`/login?redirect=/product/${productId}`)
      return
    }

    const price = product.prices?.[0]
    if (!price) {
      toast.error('No price available')
      return
    }

    try {
      const result = await checkoutMutation.mutateAsync({
        productId: product.id,
        priceId: price.id,
        redirectUrl: window.location.href,
      })
      window.location.href = result.purchaseUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    }
  }

  const price = product?.prices?.[0]
  const previewUrl = product?.metadata?.previewUrl

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Store className="size-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-lg font-medium">Product not found</h1>
          <p className="text-sm text-muted-foreground mt-1">This product may have been removed.</p>
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link href="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          {product.metadata?.thumbnailUrl ? (
            <img
              src={product.metadata.thumbnailUrl}
              alt={product.title}
              className="max-h-48 mx-auto mb-6 rounded-xl object-contain"
            />
          ) : (
            <Store className="size-16 text-muted-foreground/40 mx-auto mb-6" />
          )}
          <h1 className="text-xl font-semibold">{product.title}</h1>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
          )}
          <p className="text-xs text-muted-foreground/60 mt-2">by {product.merchantName}</p>
          {price && (
            <div className="mt-6">
              <p className="text-2xl font-bold">{formatPrice(price.amount, price.currency)}</p>
              <Button className="mt-3" onClick={handleBuy} disabled={checkoutMutation.isPending}>
                {checkoutMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {isAuthenticated ? 'Buy Now' : 'Sign in to Buy'}
              </Button>
            </div>
          )}
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="size-3.5 mr-1.5" />
              Back to Marketplace
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Full-screen iframe */}
      <iframe
        src={previewUrl}
        title={product.title}
        className="size-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      {/* Simple floating widget - always visible */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-background/95 backdrop-blur-xl border rounded-full shadow-2xl flex items-center gap-1 p-1.5 pl-4">
          <Link 
            href="/marketplace" 
            className="size-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="h-4 w-px bg-border mx-1" />

          <span className="text-sm font-medium px-2 truncate max-w-48">{product.title}</span>

          {price && (
            <Button 
              size="sm" 
              className="h-8 rounded-full gap-2"
              onClick={() => setBuyModalOpen(true)}
            >
              <ShoppingBag className="size-3.5" />
              {formatPrice(price.amount, price.currency)}
            </Button>
          )}
        </div>
      </div>

      {/* Buy Modal */}
      <Dialog open={buyModalOpen} onOpenChange={setBuyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{product.title}</DialogTitle>
            <DialogDescription className="text-xs">
              by {product.merchantName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {product.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            )}

            {price && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold">{formatPrice(price.amount, price.currency)}</p>
                  <p className="text-xs text-muted-foreground">One-time payment</p>
                </div>

                <Button 
                  size="lg" 
                  onClick={handleBuy} 
                  disabled={checkoutMutation.isPending}
                  className="px-8"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingBag className="size-4 mr-2" />
                  )}
                  {isAuthenticated ? 'Buy Now' : 'Sign in to Buy'}
                </Button>
              </div>
            )}

            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              <ExternalLink className="size-3" />
              Open preview in new tab
            </a>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" />
    </div>
  )
}
