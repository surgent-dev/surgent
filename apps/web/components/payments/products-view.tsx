'use client'

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
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={cn(
            'size-1.5 rounded-full shrink-0',
            isRecurring ? 'bg-brand' : 'bg-muted-foreground',
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

  const handleCreateCheckout = async (priceId?: string) => {
    const selectedPriceId = priceId || prices[0]?.id
    if (!selectedPriceId) return

    try {
      const redirectUrl =
        window.location.protocol === 'https:'
          ? window.location.href
          : 'https://example.com/checkout-complete'
      const response = await payHttp
        .post('checkout', {
          searchParams: { projectId },
          json: {
            customerId: 'test-customer-123',
            productId: product.id,
            priceId: selectedPriceId,
            successUrl: redirectUrl,
            cancelUrl: redirectUrl,
          },
        })
        .json<{ checkoutUrl: string }>()
      window.open(response.checkoutUrl, '_blank')
    } catch (error) {
      alert(
        'Failed to create checkout: ' + (error instanceof Error ? error.message : 'Unknown error'),
      )
    }
  }

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border/80',
        product.isArchived && 'opacity-50',
      )}
    >
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate mb-0.5">{product.name}</h4>
            <div className="flex items-center gap-1.5">
              {hasRecurring && (
                <span className="inline-flex items-center gap-1 text-[10px] text-brand font-medium">
                  <RefreshCw className="size-2.5" />
                  Subscription
                </span>
              )}
              {hasOneTime && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  <Zap className="size-2.5" />
                  One-time
                </span>
              )}
              {product.isArchived && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Archived
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="size-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
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
        {product.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
        )}
      </div>

      <div className="px-3 pb-3">
        {prices.length > 0 ? (
          <div className="rounded-lg border bg-muted/20 divide-y">
            {prices.map((price) => (
              <PriceRow key={price.id} price={price} />
            ))}
          </div>
        ) : (
          <button
            onClick={() => onAddPrice(item)}
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="size-3.5" />
            Add pricing to publish
          </button>
        )}
      </div>

      <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-between gap-2">
        <code className="text-[10px] text-muted-foreground font-mono truncate">{product.slug}</code>
        {prices.length > 0 && (
          <button
            onClick={() => handleCreateCheckout()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-brand text-brand-foreground hover:bg-brand/90 transition-colors"
          >
            <CreditCard className="size-3" />
            Checkout
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
        <div className="text-center">
          <Loader2 className="size-8 text-muted-foreground animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading products...</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="rounded-2xl bg-muted/50 p-5 inline-block mb-4">
            <Package className="size-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold mb-1">No products yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first product to start accepting payments
          </p>
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-brand-foreground font-medium text-sm hover:bg-brand/90 transition-colors"
          >
            <Plus className="size-4" />
            Create Product
          </button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
