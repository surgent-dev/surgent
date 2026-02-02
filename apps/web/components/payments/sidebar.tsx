'use client'

import Image from 'next/image'
import { LayoutDashboard, Package, Users, Receipt, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewType = 'dashboard' | 'products' | 'customers' | 'transactions' | 'settings'

export interface AccountData {
  email?: string
  title?: string
  country?: string
  [key: string]: unknown
}

interface NavItemProps {
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
  badge?: number | string
}

function NavItem({ icon: Icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={2} />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'text-xs tabular-nums px-1.5 py-0.5 rounded-md min-w-[20px] text-center font-medium',
            active ? 'bg-background text-muted-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

interface SidebarProps {
  view: ViewType
  setView: (view: ViewType) => void
  productCount: number
  customerCount: number
  transactionCount: number
  stripeConnected: boolean
  stripeProcessor?: string
  accountData?: AccountData
}

export function Sidebar({
  view,
  setView,
  productCount,
  customerCount,
  transactionCount,
  stripeConnected,
  stripeProcessor,
  accountData,
}: SidebarProps) {
  return (
    <div className="w-52 shrink-0 border-r bg-muted/10 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2.5">
          {stripeProcessor === 'whop' ? (
            <div className="size-8 rounded-lg bg-[#FF6243] grid place-items-center">
              <Image
                src="/whop_logo_brandmark_orange.svg"
                alt="Whop"
                width={18}
                height={9}
                className="brightness-0 invert"
              />
            </div>
          ) : (
            <div className="size-8 rounded-lg overflow-hidden">
              <Image src="/Stripe_icon_-_square.svg" alt="Stripe" width={32} height={32} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{accountData?.title || 'Payments'}</p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {stripeConnected ? stripeProcessor || 'Stripe' : 'Not connected'}
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-0.5">
        <NavItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={view === 'dashboard'}
          onClick={() => setView('dashboard')}
        />
        <NavItem
          icon={Package}
          label="Products"
          active={view === 'products'}
          onClick={() => setView('products')}
          badge={productCount > 0 ? productCount : undefined}
        />
        <NavItem
          icon={Users}
          label="Customers"
          active={view === 'customers'}
          onClick={() => setView('customers')}
          badge={customerCount > 0 ? customerCount : undefined}
        />
        <NavItem
          icon={Receipt}
          label="Transactions"
          active={view === 'transactions'}
          onClick={() => setView('transactions')}
          badge={transactionCount > 0 ? transactionCount : undefined}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          active={view === 'settings'}
          onClick={() => setView('settings')}
        />
      </div>
    </div>
  )
}
