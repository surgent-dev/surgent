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
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
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
        <span
          className={cn(
            'text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {badge}
        </span>
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
  const setEnv = usePayEnv((s) => s.setEnv)
  const isLive = env === 'live'

  return (
    <div className="w-52 shrink-0 border-r flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg border bg-background grid place-items-center overflow-hidden shrink-0">
            <Image src="/surpay-coin.svg" alt="Surgent" width={22} height={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider leading-none mb-1">
              Company
            </p>
            <p className="text-sm font-semibold truncate leading-tight">
              {accountData?.title || 'Payments'}
            </p>
          </div>
        </div>

        <div className="mt-3 relative rounded-lg border bg-muted/30 p-1 grid grid-cols-2">
          <div
            className={cn(
              'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md bg-background shadow-sm border transition-all duration-200 ease-out',
              isLive ? 'left-[calc(50%+2px)]' : 'left-1',
            )}
          />
          <button
            type="button"
            onClick={() => setEnv('test')}
            className={cn(
              'relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors duration-200',
              !isLive ? 'text-amber-600' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FlaskConical
              className={cn('size-3', !isLive ? 'text-amber-500' : 'text-muted-foreground/50')}
              strokeWidth={2}
            />
            Sandbox
          </button>
          <button
            type="button"
            onClick={() => setEnv('live')}
            className={cn(
              'relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors duration-200',
              isLive ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Globe
              className={cn('size-3', isLive ? 'text-emerald-500' : 'text-muted-foreground/50')}
              strokeWidth={2}
            />
            Live
          </button>
        </div>
      </div>

      <div className="h-px bg-border/60 mx-4" />

      <nav className="flex-1 px-2.5 py-2.5 space-y-1">
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

        <div className="h-px bg-border/60 my-2 !mx-0" />

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
