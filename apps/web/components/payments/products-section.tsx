'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useProducts,
  type Product,
  type ProductWithPrices,
  type ProductPrice,
} from '@/queries/products'
import { useTransactions } from '@/queries/transactions'
import { useCustomers } from '@/queries/customers'
import { useSubscriptions } from '@/queries/subscriptions'
import { CreateProductDialog } from './create-product-dialog'
import { CreatePriceDialog } from './create-price-dialog'
import { EditProductDialog } from './edit-product-dialog'
import { Sidebar, type ViewType, type AccountData } from './sidebar'
import { DashboardView } from './dashboard-view'
import { ProductsView } from './products-view'
import { TransactionsView } from './transactions-view'
import { CustomersView } from './customers-view'
import { SubscriptionsView } from './subscriptions-view'
import { SettingsView } from './settings-view'
import { payHttp } from '@/lib/http'

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

  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createPriceOpen, setCreatePriceOpen] = useState(false)
  const [editProductOpen, setEditProductOpen] = useState(false)
  const [openingPayoutPortal, setOpeningPayoutPortal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPrices, setSelectedPrices] = useState<ProductPrice[]>([])

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
          <h1 className="text-[14px] font-semibold">{viewTitles[view]}</h1>
          {view === 'products' && (
            <button
              onClick={handleCreateProduct}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Plus className="size-3.5" />
              New Product
            </button>
          )}
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
