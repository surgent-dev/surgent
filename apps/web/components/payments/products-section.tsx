'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useProducts,
  type Product,
  type ProductWithPrices,
  type ProductPrice,
} from '@/queries/products'
import { useTransactions } from '@/queries/transactions'
import { useCustomers } from '@/queries/customers'
import { CreateProductDialog } from './create-product-dialog'
import { CreatePriceDialog } from './create-price-dialog'
import { EditProductDialog } from './edit-product-dialog'
import { Sidebar, type ViewType, type AccountData } from './sidebar'
import { DashboardView } from './dashboard-view'
import { ProductsView } from './products-view'
import { TransactionsView } from './transactions-view'
import { CustomersView } from './customers-view'
import { SettingsView } from './settings-view'

export function ProductsSection({
  projectId,
  stripeConnected = false,
  stripeProcessor,
  accountData,
  onDisconnect,
  isDisconnecting,
}: {
  projectId: string
  stripeConnected?: boolean
  stripeProcessor?: string
  accountData?: AccountData
  onDisconnect?: () => void
  isDisconnecting?: boolean
}) {
  const { data: products, isLoading: productsLoading } = useProducts(projectId)
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions(projectId)
  const { data: customersData, isLoading: customersLoading } = useCustomers(projectId)
  const [view, setView] = useState<ViewType>('dashboard')

  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createPriceOpen, setCreatePriceOpen] = useState(false)
  const [editProductOpen, setEditProductOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPrices, setSelectedPrices] = useState<ProductPrice[]>([])

  const allProducts = products ?? []
  const activeProducts = allProducts.filter((p) => !p.product.isArchived)
  const transactions = transactionsData?.transactions ?? []
  const customers = customersData?.customers ?? []

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

  const viewTitles: Record<ViewType, string> = {
    dashboard: 'Dashboard',
    products: 'Products',
    customers: 'Customers',
    transactions: 'Transactions',
    settings: 'Settings',
  }

  return (
    <div className="h-full flex">
      <Sidebar
        view={view}
        setView={setView}
        productCount={activeProducts.length}
        customerCount={customers.length}
        transactionCount={transactions.length}
        stripeConnected={stripeConnected}
        stripeProcessor={stripeProcessor}
        accountData={accountData}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 px-4 flex items-center justify-between border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">{viewTitles[view]}</h1>
            {view === 'products' && activeProducts.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {activeProducts.length} product{activeProducts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {view === 'products' && (
            <button
              onClick={handleCreateProduct}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 transition-colors"
            >
              <Plus className="size-4" />
              New Product
            </button>
          )}
        </header>

        {view === 'dashboard' && (
          <DashboardView
            products={allProducts}
            transactions={transactions}
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
        {view === 'customers' && (
          <CustomersView customers={customers} isLoading={customersLoading} />
        )}
        {view === 'transactions' && (
          <TransactionsView transactions={transactions} isLoading={transactionsLoading} />
        )}
        {view === 'settings' && (
          <SettingsView
            stripeConnected={stripeConnected}
            stripeProcessor={stripeProcessor}
            onDisconnect={onDisconnect}
            isDisconnecting={isDisconnecting}
          />
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
