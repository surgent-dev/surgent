'use client'

import Image from 'next/image'
import {
  ArrowUpRight,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Package,
  Repeat,
  Users,
  Receipt,
  Settings,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePayEnv } from '@/stores/pay-env'

export type ViewType =
  | 'dashboard'
  | 'products'
  | 'subscriptions'
  | 'customers'
  | 'transactions'
  | 'settings'

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
  trailingIcon?: React.ElementType
  disabled?: boolean
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  trailingIcon: TrailingIcon,
  disabled,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-foreground/[0.06] text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]',
        disabled &&
          'opacity-40 cursor-not-allowed hover:text-muted-foreground hover:bg-transparent',
      )}
    >
      <Icon className="size-[15px] shrink-0" strokeWidth={active ? 2 : 1.75} />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && (
        <span className="text-[11px] tabular-nums text-muted-foreground font-normal">{badge}</span>
      )}
      {!badge && TrailingIcon && <TrailingIcon className="size-3.5 text-muted-foreground" />}
    </button>
  )
}

interface SidebarProps {
  view: ViewType
  setView: (view: ViewType) => void
  productCount: number
  subscriptionCount: number
  customerCount: number
  transactionCount: number
  isConnected: boolean
  processor?: string
  accountData?: AccountData
  onOpenPayoutsPortal?: () => void
  isOpeningPayoutsPortal?: boolean
}

export function Sidebar({
  view,
  setView,
  productCount,
  subscriptionCount,
  customerCount,
  transactionCount,
  isConnected,
  processor,
  accountData,
  onOpenPayoutsPortal,
  isOpeningPayoutsPortal,
}: SidebarProps) {
  const showPayouts = isConnected && processor === 'whop' && onOpenPayoutsPortal
  const env = usePayEnv((s) => s.env)
  const isLive = env === 'live'

  return (
    <div className="w-52 shrink-0 border-r flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg border bg-background grid place-items-center overflow-hidden shrink-0">
            <Image src="/surpay-coin.svg" alt="Surgent" width={22} height={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Company</p>
            <p className="text-[13px] font-semibold truncate leading-tight">
              {accountData?.title || 'Payments'}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'mt-2.5 flex items-center gap-1.5 px-2 py-1 rounded-md w-fit',
            isLive ? 'bg-emerald-500/10' : 'bg-amber-500/10',
          )}
        >
          {isLive ? (
            <>
              <Globe className="size-3 text-emerald-600" strokeWidth={2} />
              <span className="text-[11px] font-medium text-emerald-600">Live</span>
            </>
          ) : (
            <>
              <FlaskConical className="size-3 text-amber-600" strokeWidth={2} />
              <span className="text-[11px] font-medium text-amber-600">Sandbox</span>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-border mx-4" />

      <nav className="flex-1 px-3 py-3 space-y-0.5">
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
          icon={Repeat}
          label="Subscriptions"
          active={view === 'subscriptions'}
          onClick={() => setView('subscriptions')}
          badge={subscriptionCount > 0 ? subscriptionCount : undefined}
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

        <div className="h-px bg-border my-2 !mx-0" />

        {showPayouts && (
          <NavItem
            icon={Wallet}
            label="Payouts"
            active={false}
            trailingIcon={ArrowUpRight}
            onClick={() => onOpenPayoutsPortal?.()}
            disabled={isOpeningPayoutsPortal}
          />
        )}
        <NavItem
          icon={Settings}
          label="Settings"
          active={view === 'settings'}
          onClick={() => setView('settings')}
        />
      </nav>
    </div>
  )
}
