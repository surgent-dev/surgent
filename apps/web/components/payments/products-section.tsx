'use client'

import { useState } from 'react'
import { ArrowUpFromLine, Loader2, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useProducts,
  useSyncProducts,
  type Product,
  type ProductWithPrices,
  type ProductPrice,
} from '@/queries/products'
import { useTransactions } from '@/queries/transactions'
import { useCustomers } from '@/queries/customers'
import { useSubscriptions } from '@/queries/subscriptions'
import { CreateProductSheet } from './create-product-sheet'
import { CreatePriceDialog } from './create-price-dialog'
import { EditProductDialog } from './edit-product-dialog'
import { Sidebar, type ViewType, type AccountData } from './sidebar'
import { usePayEnv } from '@/stores/pay-env'
import { DashboardView } from './dashboard-view'
import { ProductsView } from './products-view'
import { TransactionsView } from './transactions-view'
import { CustomersView } from './customers-view'
import { SubscriptionsView } from './subscriptions-view'
import { SettingsView } from './settings-view'
import { payHttp } from '@/lib/http'
import { cn } from '@/lib/utils'

export function ProductsSection({
  projectId,
  isConnected = false,
  processor,
  accountData,
  accountId,
  onDisconnect,
  isDisconnecting,
}: {
  projectId: string
  isConnected?: boolean
  processor?: string
  accountData?: AccountData
  accountId?: string
  onDisconnect?: () => void
  isDisconnecting?: boolean
}) {
  const { data: products, isLoading: productsLoading } = useProducts(projectId)
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions(projectId)
  const { data: customersData, isLoading: customersLoading } = useCustomers(projectId)
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useSubscriptions(projectId)
  const [view, setView] = useState<ViewType>('dashboard')

  const payEnv = usePayEnv((s) => s.env)
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createPriceOpen, setCreatePriceOpen] = useState(false)
  const [editProductOpen, setEditProductOpen] = useState(false)
  const [openingPayoutPortal, setOpeningPayoutPortal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPrices, setSelectedPrices] = useState<ProductPrice[]>([])

  const syncProducts = useSyncProducts(projectId)

  const allProducts = products ?? []
  const activeProducts = allProducts.filter((p) => !p.product.isArchived)
  const transactions = transactionsData?.transactions ?? []
  const customers = customersData?.customers ?? []
  const subscriptions = subscriptionsData ?? []

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setEditProductOpen(true)
  }

  const handleAddPrice = (item: ProductWithPrices) => {
    setSelectedProduct(item.product)
    setSelectedPrices(item.prices)
    setCreatePriceOpen(true)
  }

  const handleCreateProduct = () => {
    setCreateProductOpen(true)
  }

  const handleSyncToLive = () => {
    syncProducts.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Synced ${data.synced} products to live (${data.skipped} skipped)`)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to sync products')
      },
    })
  }

  const openPayoutPortal = async () => {
    if (processor !== 'whop' || !accountId) {
      toast.error('Payment account is not connected')
      return
    }
    setOpeningPayoutPortal(true)
    try {
      const data = await payHttp
        .get('accounts/whop/payouts-link', {
          searchParams: { accountId, redirectBaseUrl: window.location.origin },
        })
        .json<{ url?: string }>()

      if (!data.url) throw new Error('Missing payouts portal URL')
      window.open(data.url, '_blank', 'noopener')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open payouts portal')
    } finally {
      setOpeningPayoutPortal(false)
    }
  }

  const viewTitles: Record<ViewType, string> = {
    dashboard: 'Dashboard',
    products: 'Products',
    subscriptions: 'Subscriptions',
    customers: 'Customers',
    transactions: 'Transactions',
    settings: 'Settings',
  }

  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar
        view={view}
        setView={setView}
        productCount={activeProducts.length}
        subscriptionCount={subscriptions.length}
        customerCount={customers.length}
        transactionCount={transactions.length}
        isConnected={isConnected}
        processor={processor}
        accountData={accountData}
        onOpenPayoutsPortal={openPayoutPortal}
        isOpeningPayoutsPortal={openingPayoutPortal}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b shrink-0 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <h1 className="text-[14px] font-semibold">{viewTitles[view]}</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-medium leading-relaxed',
                payEnv === 'test'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  payEnv === 'test' ? 'bg-amber-500' : 'bg-emerald-500',
                )}
              />
              {payEnv === 'test' ? 'Sandbox' : 'Live'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {view === 'products' && payEnv === 'test' && activeProducts.length > 0 && (
              <button
                onClick={handleSyncToLive}
                disabled={syncProducts.isPending}
                className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium rounded-md border bg-background btn-elevated hover:bg-muted/30 transition-all duration-100 disabled:opacity-50"
              >
                {syncProducts.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="size-3" />
                )}
                Sync to Live
              </button>
            )}
            {view === 'products' && payEnv === 'live' && (
              <button
                onClick={handleSyncToLive}
                disabled={syncProducts.isPending}
                className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium rounded-md border bg-background btn-elevated hover:bg-muted/30 transition-all duration-100 disabled:opacity-50"
              >
                {syncProducts.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="size-3" />
                )}
                Sync from Sandbox
              </button>
            )}
            {view === 'products' && (
              <button
                onClick={handleCreateProduct}
                className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium rounded-md bg-primary text-primary-foreground btn-elevated-primary hover:bg-primary-hover transition-all duration-100"
              >
                <Plus className="size-3" />
                New Product
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {view === 'dashboard' && (
            <DashboardView
              products={allProducts}
              transactions={transactions}
              subscriptions={subscriptions}
              onCreateProduct={handleCreateProduct}
            />
          )}
          {view === 'products' && (
            <ProductsView
              products={activeProducts}
              isLoading={productsLoading}
              projectId={projectId}
              onEdit={handleEdit}
              onAddPrice={handleAddPrice}
              onCreateProduct={handleCreateProduct}
            />
          )}
          {view === 'subscriptions' && (
            <SubscriptionsView
              subscriptions={subscriptions}
              isLoading={subscriptionsLoading}
              projectId={projectId}
            />
          )}
          {view === 'customers' && (
            <CustomersView
              customers={customers}
              isLoading={customersLoading}
              projectId={projectId}
            />
          )}
          {view === 'transactions' && (
            <TransactionsView transactions={transactions} isLoading={transactionsLoading} />
          )}
          {view === 'settings' && (
            <SettingsView
              isConnected={isConnected}
              processor={processor}
              onDisconnect={onDisconnect}
              isDisconnecting={isDisconnecting}
            />
          )}
        </div>
      </div>

      <CreateProductSheet
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
