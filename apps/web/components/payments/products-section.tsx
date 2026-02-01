'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Archive, Loader2, MoreHorizontal, Package, Pencil, Plus, Settings } from 'lucide-react'
import {
  useProducts,
  type Product,
  type ProductWithPrices,
  type ProductPrice,
} from '@/queries/products'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { payHttp } from '@/lib/http'
import { CreateProductDialog } from './create-product-dialog'
import { CreatePriceDialog } from './create-price-dialog'
import { EditProductDialog } from './edit-product-dialog'
import { cn } from '@/lib/utils'

const formatPrice = (cents: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

const formatInterval = (interval: ProductPrice['recurringInterval']) => {
  switch (interval) {
    case 'month':
      return 'per month'
    case 'year':
      return 'per year'
    case 'week':
      return 'per week'
    case 'day':
      return 'per day'
    default:
      return 'one-time'
  }
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center px-4">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Loader2 className="size-6 text-muted-foreground animate-spin" strokeWidth={1.5} />
      </div>
      <p className="font-medium text-sm">Loading products</p>
      <p className="text-xs text-muted-foreground">Please wait...</p>
    </div>
  )
}

function EmptyState({ isArchived }: { isArchived?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center px-4">
      <div className="rounded-full bg-muted p-3 mb-3">
        {isArchived ? (
          <Archive className="size-6 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <Package className="size-6 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>
      <p className="font-medium text-sm">
        {isArchived ? 'No archived products' : 'No products yet'}
      </p>
      <p className="text-xs text-muted-foreground">
        {isArchived
          ? 'Archived products will appear here'
          : 'Create your first product to start accepting payments'}
      </p>
    </div>
  )
}

function PricePill({ price }: { price: ProductPrice }) {
  const interval = formatInterval(price.recurringInterval)
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 text-sm">
      <span className="font-semibold tabular-nums">
        {formatPrice(price.priceAmount, price.priceCurrency)}
      </span>
      <span className="text-muted-foreground">{interval}</span>
    </div>
  )
}

function ProductCard({
  item,
  projectId,
  onEdit,
  onAddPrice,
}: {
  item: ProductWithPrices
  projectId: string
  onEdit: (product: Product) => void
  onAddPrice: (item: ProductWithPrices) => void
}) {
  const { product, prices } = item
  const canAddPrice = prices.length === 0

  const handleTestCheckout = async () => {
    const priceId = prices[0]?.id
    if (!priceId) return

    const confirmed = window.confirm('This will create a real checkout session. Continue?')
    if (!confirmed) return

    try {
      // Whop requires HTTPS URLs - use current URL if HTTPS, otherwise use placeholder
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
            priceId: priceId,
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
        'rounded-lg border bg-card p-4 space-y-3 shadow-sm',
        product.isArchived && 'opacity-60',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{product.name}</span>
          {product.isArchived && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!product.isArchived && canAddPrice && (
            <button
              onClick={() => onAddPrice(item)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              <span>Add Price</span>
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {prices.length > 0 && (
                <DropdownMenuItem onClick={handleTestCheckout}>Test Checkout</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Pencil className="mr-2 size-3" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Prices */}
      {prices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {prices.map((price) => (
            <PricePill key={price.id} price={price} />
          ))}
        </div>
      )}
    </div>
  )
}

interface NavItemProps {
  icon: React.ElementType
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function NavItem({ icon: Icon, label, count, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors',
        active
          ? 'bg-foreground/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="size-4" strokeWidth={active ? 2 : 1.5} />
        <span>{label}</span>
      </div>
      {count >= 0 && (
        <span
          className={cn(
            'text-xs tabular-nums px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
            active ? 'bg-foreground/10' : 'bg-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

interface SettingsNavItemProps {
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
}

function SettingsNavItem({ icon: Icon, label, active, onClick }: SettingsNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors',
        active
          ? 'bg-foreground/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
      )}
    >
      <Icon className="size-4" strokeWidth={active ? 2 : 1.5} />
      <span>{label}</span>
    </button>
  )
}

interface StripeStatusCardProps {
  isConnected: boolean
  processor?: string
  onDisconnect?: () => void
  isDisconnecting?: boolean
}

function StripeStatusCard({
  isConnected,
  processor,
  onDisconnect,
  isDisconnecting,
}: StripeStatusCardProps) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'size-8 rounded-md flex items-center justify-center',
            isConnected ? 'bg-success/10' : 'bg-muted',
            processor === 'whop' && 'bg-[#FF6243]',
          )}
        >
          {processor === 'whop' ? (
            <Image
              src="/whop_logo_brandmark_orange.svg"
              alt="Whop"
              width={20}
              height={10}
              className="brightness-0 invert"
            />
          ) : (
            <Image
              src="/Stripe_icon_-_square.svg"
              alt="Stripe"
              width={20}
              height={20}
              className="size-5"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">{processor || 'Stripe'}</span>
            {isConnected && <span className="size-2 rounded-full bg-success animate-pulse" />}
          </div>
          <span className={cn('text-xs', isConnected ? 'text-success' : 'text-muted-foreground')}>
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>
      {isConnected && onDisconnect && (
        <button
          onClick={onDisconnect}
          disabled={isDisconnecting}
          className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      )}
    </div>
  )
}

export function ProductsSection({
  projectId,
  stripeConnected = false,
  stripeProcessor,
  onDisconnect,
  isDisconnecting,
}: {
  projectId: string
  stripeConnected?: boolean
  stripeProcessor?: string
  onDisconnect?: () => void
  isDisconnecting?: boolean
}) {
  const { data: products, isLoading } = useProducts(projectId)
  const [view, setView] = useState<'active' | 'archived' | 'settings'>('active')

  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createPriceOpen, setCreatePriceOpen] = useState(false)
  const [editProductOpen, setEditProductOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPrices, setSelectedPrices] = useState<ProductPrice[]>([])

  const activeProducts = products?.filter((p) => !p.product.isArchived) ?? []
  const archivedProducts = products?.filter((p) => p.product.isArchived) ?? []
  const displayProducts = view === 'active' ? activeProducts : archivedProducts

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setEditProductOpen(true)
  }

  const handleAddPrice = (item: ProductWithPrices) => {
    setSelectedProduct(item.product)
    setSelectedPrices(item.prices)
    setCreatePriceOpen(true)
  }

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-[200px] shrink-0 border-r bg-muted/20 p-3 flex flex-col gap-4">
        <div className="space-y-1">
          <NavItem
            icon={Package}
            label="Products"
            count={activeProducts.length}
            active={view === 'active'}
            onClick={() => setView('active')}
          />
          <NavItem
            icon={Archive}
            label="Archived"
            count={archivedProducts.length}
            active={view === 'archived'}
            onClick={() => setView('archived')}
          />
          <SettingsNavItem
            icon={Settings}
            label="Settings"
            active={view === 'settings'}
            onClick={() => setView('settings')}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-11 px-4 flex items-center justify-between border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            {view === 'active' && <Package className="size-4 text-muted-foreground" />}
            {view === 'archived' && <Archive className="size-4 text-muted-foreground" />}
            {view === 'settings' && <Settings className="size-4 text-muted-foreground" />}
            <span className="font-medium text-sm">
              {view === 'active' ? 'Products' : view === 'archived' ? 'Archived' : 'Settings'}
            </span>
            {view !== 'settings' && displayProducts.length > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {displayProducts.length} item
                  {displayProducts.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          {view === 'active' && (
            <button
              onClick={() => setCreateProductOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Plus className="size-4" />
              <span>Create</span>
            </button>
          )}
        </header>

        {view === 'settings' ? (
          <div className="p-4 max-w-md">
            <StripeStatusCard
              isConnected={stripeConnected}
              processor={stripeProcessor}
              onDisconnect={onDisconnect}
              isDisconnecting={isDisconnecting}
            />
          </div>
        ) : isLoading ? (
          <LoadingState />
        ) : displayProducts.length === 0 ? (
          <EmptyState isArchived={view === 'archived'} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {displayProducts.map((item) => (
                <ProductCard
                  key={item.product.id}
                  item={item}
                  projectId={projectId}
                  onEdit={handleEdit}
                  onAddPrice={handleAddPrice}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <CreateProductDialog
        projectId={projectId}
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
      />

      <CreatePriceDialog
        projectId={projectId}
        productGroup={selectedProduct?.productGroup ?? ''}
        productName={selectedProduct?.name ?? ''}
        open={createPriceOpen}
        onOpenChange={setCreatePriceOpen}
        existingPrices={selectedPrices}
      />

      {selectedProduct && (
        <EditProductDialog
          projectId={projectId}
          product={selectedProduct}
          open={editProductOpen}
          onOpenChange={setEditProductOpen}
        />
      )}
    </div>
  )
}
