'use client'

import { useState } from 'react'
import { ArrowUpFromLine, CircleDollarSign, Loader2, Plus, ArrowRight } from 'lucide-react'
import { CircleNotch } from '@phosphor-icons/react'
import Image from 'next/image'
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
import {
  useSurpayAccounts,
  useSurpayDisconnect,
  useWhopConnect,
  type SurpayAccount,
} from '@/queries/surpay'
import { usePayEnv } from '@/stores/pay-env'
import { parseConnectError } from '@/components/payments/utils'
import { CreateProductSheet } from './create-product-sheet'
import { CreatePriceDialog } from './create-price-dialog'
import { EditProductDialog } from './edit-product-dialog'
import { Sidebar, type ViewType, type AccountData } from './sidebar'
import { DashboardView } from './dashboard-view'
import { ProductsView } from './products-view'
import { TransactionsView } from './transactions-view'
import { CustomersView } from './customers-view'
import { SubscriptionsView } from './subscriptions-view'
import { DocumentationView } from './documentation-view'
import { SettingsView } from './settings-view'
import { payHttp } from '@/lib/http'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FunLoadingState } from '@/components/ui/fun-loading'

function ConnectPaymentsView({ disconnectedAccount }: { disconnectedAccount?: SurpayAccount }) {
  const [companyName, setCompanyName] = useState('')
  const whopConnect = useWhopConnect()
  const env = usePayEnv((s) => s.env)
  const isLive = env === 'live'

  const handleReconnect = async () => {
    if (!disconnectedAccount) return
    try {
      await whopConnect.mutateAsync({
        accountId: disconnectedAccount.id,
        data: {
          email: disconnectedAccount.data.email || '',
          title: disconnectedAccount.data.title || '',
          country: disconnectedAccount.data.country || 'us',
        },
      })
      toast.success('Payment account reconnected')
    } catch (err: any) {
      toast.error(parseConnectError(err, 'Failed to reconnect account'))
    }
  }

  const handleCreate = async () => {
    if (!companyName.trim()) return
    let session
    try {
      session = await authClient.getSession()
    } catch {
      toast.error('Failed to get session')
      return
    }
    const email = session.data?.user?.email
    if (!email) {
      toast.error('Unable to get user email')
      return
    }
    try {
      await whopConnect.mutateAsync({
        data: { email, title: companyName.trim(), country: 'us' },
      })
      toast.success('Payment account created')
      setCompanyName('')
    } catch (err: any) {
      toast.error(parseConnectError(err, 'Failed to create account'))
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="flex flex-col items-center w-full max-w-[360px]">
        {/* Integration logos */}
        <div className="flex items-center mb-8">
          <div className="size-[60px] rounded-[18px] border bg-card shadow-sm grid place-items-center">
            <Image
              src="/surgent-coin.svg"
              alt="Surgent"
              width={32}
              height={32}
              className="size-8 object-contain"
            />
          </div>
          <div className="flex items-center w-10">
            <div className="w-full border-t border-dashed border-border" />
          </div>
          <div className="size-[60px] rounded-[18px] border bg-card shadow-sm grid place-items-center">
            <Image
              src="/whop_logo_brandmark_orange.svg"
              alt="Whop"
              width={30}
              height={30}
              className="size-[30px]"
            />
          </div>
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-bold tracking-tight mb-2">Start accepting payments</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Surgent partners with <span className="text-foreground font-medium">Whop</span> to let
            you sell access, manage subscriptions, and get paid.
          </p>
        </div>

        {disconnectedAccount ? (
          <button
            type="button"
            onClick={handleReconnect}
            disabled={whopConnect.isPending}
            className={cn(
              'flex items-center gap-4 w-full p-4 rounded-[16px] text-left transition-all',
              'bg-muted border border-border/50',
              'hover:bg-accent disabled:opacity-50',
            )}
          >
            <div className="size-10 rounded-xl bg-[#FF6243]/10 grid place-items-center shrink-0">
              <Image
                src="/whop_logo_brandmark_orange.svg"
                alt="Whop"
                width={20}
                height={20}
                className="size-5"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">
                {disconnectedAccount.data.title || 'Untitled'}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {whopConnect.isPending ? 'Reconnecting...' : 'Tap to reconnect'}
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                isLive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600',
              )}
            >
              {isLive ? 'Live' : 'Sandbox'}
            </span>
          </button>
        ) : (
          <div className="w-full space-y-3">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && companyName.trim()) handleCreate()
              }}
              className={cn(
                'flex h-12 w-full rounded-xl px-4 py-2 text-sm',
                'text-foreground placeholder:text-muted-foreground/40',
                'bg-black/[0.03] border border-black/[0.08] transition-all duration-150 outline-none',
                'hover:bg-black/[0.05] hover:border-black/[0.12]',
                'focus:bg-black/[0.05] focus:border-black/[0.16] focus:ring-2 focus:ring-black/[0.04]',
                'dark:bg-white/[0.04] dark:border-white/[0.08]',
                'dark:hover:bg-white/[0.06] dark:hover:border-white/[0.14]',
                'dark:focus:bg-white/[0.07] dark:focus:border-white/[0.18] dark:focus:ring-white/[0.06]',
              )}
            />
            <Button
              onClick={handleCreate}
              disabled={!companyName.trim() || whopConnect.isPending}
              className="w-full h-12 rounded-2xl font-bold text-sm"
            >
              {whopConnect.isPending ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <>
                  Connect Whop
                  <ArrowRight className="size-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ConnectedDashboard({
  projectId,
  processor,
  accountData,
  accountId,
  onDisconnect,
  isDisconnecting,
}: {
  projectId: string
  processor?: string
  accountData?: AccountData
  accountId?: string
  onDisconnect?: () => void
  isDisconnecting?: boolean
}) {
  const showDocumentation = process.env.NODE_ENV !== 'production'
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
    documentation: showDocumentation ? 'Documentation' : 'Dashboard',
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
        isConnected
        processor={processor}
        accountData={accountData}
        onOpenPayoutsPortal={openPayoutPortal}
        isOpeningPayoutsPortal={openingPayoutPortal}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b shrink-0 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">{viewTitles[view]}</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border',
                payEnv === 'test'
                  ? 'bg-amber-500/5 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:border-amber-400/20'
                  : 'bg-emerald-500/5 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-400/20',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full animate-pulse',
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
                className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border bg-background btn-elevated hover:bg-muted/30 transition-all duration-100 disabled:opacity-50"
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
                className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border bg-background btn-elevated hover:bg-muted/30 transition-all duration-100 disabled:opacity-50"
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
                className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md bg-primary text-primary-foreground btn-elevated-primary hover:bg-primary-hover transition-all duration-100"
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
          {view === 'documentation' && showDocumentation && <DocumentationView />}
          {view === 'documentation' && !showDocumentation && (
            <DashboardView
              products={allProducts}
              transactions={transactions}
              subscriptions={subscriptions}
              onCreateProduct={handleCreateProduct}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              isConnected
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

export function PaymentsDashboard({ projectId }: { projectId?: string }) {
  const { data: accounts, isLoading } = useSurpayAccounts()
  const disconnect = useSurpayDisconnect()
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  if (isLoading) {
    return <FunLoadingState />
  }

  const account = accounts?.find((a) => a.status === 'connected')
  const disconnected = accounts?.find((a) => a.status === 'disconnected')

  if (!account) {
    return <ConnectPaymentsView disconnectedAccount={disconnected} />
  }

  return (
    <>
      <ConnectedDashboard
        projectId={projectId!}
        processor={account.processor}
        accountData={account.data}
        accountId={account.id}
        onDisconnect={() => setDisconnectOpen(true)}
        isDisconnecting={disconnect.isPending}
      />

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Payment Account</DialogTitle>
            <DialogDescription>This will disable payment processing.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => {
                disconnect.mutate(
                  { accountId: account.id },
                  { onSuccess: () => setDisconnectOpen(false) },
                )
              }}
            >
              {disconnect.isPending ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
