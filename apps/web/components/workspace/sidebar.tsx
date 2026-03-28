'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  House,
  PenNib,
  ChartLineUp,
  SignOut,
  Moon,
  Sun,
  CreditCard,
  Lightning,
  Plus,
  SquaresFour,
} from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { useCredits } from '@/hooks/use-credits'
import PlanDialog from '@/components/plan-dialog'
import TopupDialog from '@/components/topup-dialog'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

const NAV: { icon: PhosphorIcon; label: string; href: string }[] = [
  { icon: House, label: 'Dashboard', href: '' },
  { icon: PenNib, label: 'Studio', href: '/editor' },
  { icon: ChartLineUp, label: 'Analytics', href: '/analytics' },
]

export default function WorkspaceSidebar({ companyId }: { companyId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const credits = useCredits()
  const base = `/company/${companyId}`
  const [user, setUser] = useState<{ name?: string; email?: string; image?: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user)
        setUser({
          name: data.user.name,
          email: data.user.email,
          image: data.user.image ?? undefined,
        })
    })
  }, [])

  const on = (href: string) =>
    href === '' ? pathname === base || pathname === `${base}/` : pathname.startsWith(base + href)

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop rail */}
      <aside className="hidden md:flex w-14 shrink-0 flex-col items-center py-2 gap-1">
        {/* Logo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className="size-9 rounded-xl bg-foreground text-background flex items-center justify-center text-sm font-bold hover:rounded-lg transition-all duration-200"
            >
              S
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            All projects
          </TooltipContent>
        </Tooltip>

        <div className="w-5 h-px bg-foreground/8 my-1.5" />

        {/* Nav icons */}
        {NAV.map((n) => {
          const active = on(n.href)
          return (
            <Tooltip key={n.label}>
              <TooltipTrigger asChild>
                <Link
                  href={base + n.href}
                  className={cn(
                    'size-9 rounded-xl flex items-center justify-center transition-all duration-200',
                    active
                      ? 'bg-foreground text-background rounded-lg'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:rounded-lg',
                  )}
                >
                  <n.icon className="size-[18px]" weight={active ? 'fill' : 'regular'} />
                  <span className="sr-only">{n.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {n.label}
              </TooltipContent>
            </Tooltip>
          )
        })}

        <div className="flex-1" />

        {/* User menu */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger className="size-9 rounded-xl bg-muted/60 flex items-center justify-center text-xs font-medium overflow-hidden hover:bg-muted hover:rounded-lg transition-all duration-200 focus-visible:outline-none">
            {user?.image ? (
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              initial
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-56">
            {/* User info */}
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />

            {/* Credits */}
            {credits.hasCustomer && !credits.unlimited && (
              <>
                <div className="px-3 py-2.5 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Usage</span>
                    <span className="text-[11px] tabular-nums font-medium">
                      ${credits.used.toFixed(2)} / ${credits.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        credits.usedPercent >= 90
                          ? 'bg-rose-500'
                          : credits.usedPercent >= 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${credits.usedPercent}%` }}
                    />
                  </div>
                  {credits.snapshot?.tier !== 'pro' ? (
                    <Button
                      variant="brand"
                      size="sm"
                      className="w-full h-7 text-[11px]"
                      onClick={() => {
                        setMenuOpen(false)
                        setPlanOpen(true)
                      }}
                    >
                      <Lightning className="size-3" weight="fill" />
                      Upgrade to Pro
                    </Button>
                  ) : (
                    <Button
                      variant="brand"
                      size="sm"
                      className="w-full h-7 text-[11px]"
                      onClick={() => {
                        setMenuOpen(false)
                        setTopupOpen(true)
                      }}
                    >
                      <Plus className="size-3" weight="bold" />
                      Add balance
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Actions */}
            <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? (
                <Sun className="size-3.5" />
              ) : (
                <Moon className="size-3.5" />
              )}
              {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard')}>
              <SquaresFour className="size-3.5" weight="duotone" />
              All projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => credits.openBillingPortal()}>
              <CreditCard className="size-3.5" weight="duotone" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut()
                router.push('/login')
              }}
            >
              <SignOut className="size-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      {/* Mobile bottom tabs */}
      <nav
        className="md:hidden flex items-center justify-around shrink-0 h-14 border-t border-border/20 bg-white dark:bg-card"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map((n) => {
          const active = on(n.href)
          return (
            <Link
              key={n.label}
              href={base + n.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <n.icon className="size-5" weight={active ? 'fill' : 'regular'} />
              <span className="text-[10px]">{n.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Dialogs */}
      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} />
      <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} />
    </TooltipProvider>
  )
}
