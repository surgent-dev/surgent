'use client'

import { useState } from 'react'
import {
  CreditCard,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { payHttp } from '@/lib/http'
import { cn } from '@/lib/utils'
import { formatPrice, formatInterval } from './utils'
import type { Product, ProductWithPrices, ProductPrice } from '@/queries/products'

function PriceRow({ price }: { price: ProductPrice }) {
  const interval = formatInterval(price.recurringInterval)
  const isRecurring = !!price.recurringInterval

  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-md">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={cn(
            'size-1.5 rounded-full shrink-0',
            isRecurring ? 'bg-foreground' : 'bg-muted-foreground/50',
          )}
        />
        <span className="text-xs text-muted-foreground truncate">
          {price.name || (isRecurring ? 'Recurring' : 'One-time')}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium tabular-nums">
          {formatPrice(price.priceAmount, price.priceCurrency)}
        </span>
        {interval && <span className="text-xs text-muted-foreground">{interval}</span>}
      </div>
    </div>
  )
}

interface ProductCardProps {
  item: ProductWithPrices
  projectId: string
  onEdit: (product: Product) => void
  onAddPrice: (item: ProductWithPrices) => void
}

function ProductCard({ item, projectId, onEdit, onAddPrice }: ProductCardProps) {
  const { product, prices } = item
  const hasRecurring = prices.some((p) => p.recurringInterval)
  const hasOneTime = prices.some((p) => !p.recurringInterval)
  const [creating, setCreating] = useState(false)

  const handleCreateCheckout = async (priceId?: string) => {
    const selectedPriceId = priceId || prices[0]?.id
    if (!selectedPriceId) return

    setCreating(true)
    try {
      const response = await payHttp
        .post('checkout', {
          json: {
            projectId,
            priceId: selectedPriceId,
            redirectUrl: window.location.href,
          },
        })
        .json<{ id: string; purchaseUrl: string | null }>()

      if (!response.purchaseUrl) {
        throw new Error('Checkout URL missing')
      }
      window.open(response.purchaseUrl, '_blank', 'noopener')
    } catch (error) {
      toast.error(
        'Failed to create checkout: ' + (error instanceof Error ? error.message : 'Unknown error'),
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card overflow-hidden transition-colors',
        product.isArchived && 'opacity-50',
      )}
    >
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold truncate">{product.name}</h4>
            {product.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {product.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {hasRecurring && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded-md bg-muted/60">
                  <RefreshCw className="size-2.5" />
                  Recurring
                </span>
              )}
              {hasOneTime && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded-md bg-muted/60">
                  <Zap className="size-2.5" />
                  One-time
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="size-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-all duration-100 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onEdit(product)} className="gap-2 text-xs">
                <Pencil className="size-3" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddPrice(item)} className="gap-2 text-xs">
                <Plus className="size-3" />
                Add Price
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {prices.length > 0 ? (
        <div className="px-3 pb-3">
          <div className="rounded-lg border bg-muted/20 p-1">
            {prices.map((price) => (
              <PriceRow key={price.id} price={price} />
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3">
          <button
            onClick={() => onAddPrice(item)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-100"
          >
            <Plus className="size-3" />
            Add pricing
          </button>
        </div>
      )}

      <div className="px-4 py-2 border-t flex items-center justify-between gap-2">
        <code className="text-[10px] text-muted-foreground/70 font-mono truncate">
          {product.slug}
        </code>
        {prices.length > 0 && (
          <button
            onClick={() => handleCreateCheckout()}
            disabled={creating}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground btn-elevated-primary hover:bg-primary-hover transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CreditCard className="size-3" />
            )}
            {creating ? 'Creating...' : 'Checkout'}
          </button>
        )}
      </div>
    </div>
  )
}

interface ProductsViewProps {
  products: ProductWithPrices[]
  isLoading: boolean
  projectId: string
  onEdit: (product: Product) => void
  onAddPrice: (item: ProductWithPrices) => void
  onCreateProduct: () => void
}

export function ProductsView({
  products,
  isLoading,
  projectId,
  onEdit,
  onAddPrice,
  onCreateProduct,
}: ProductsViewProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <div className="size-10 rounded-lg bg-muted/50 border grid place-items-center mx-auto mb-3">
            <Package className="size-4.5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold mb-1">No products yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first product to start accepting payments
          </p>
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground font-medium text-sm btn-elevated-primary hover:bg-primary-hover transition-all duration-100"
          >
            <Plus className="size-3.5" />
            Create Product
          </button>
          <p className="text-xs text-muted-foreground/60 mt-4">
            <span className="font-medium text-muted-foreground/80">Tip:</span> Ask AI to integrate
            payments into your app
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-[1080px] p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((item) => (
            <ProductCard
              key={item.product.id}
              item={item}
              projectId={projectId}
              onEdit={onEdit}
              onAddPrice={onAddPrice}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
