'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  House,
  PencilSimpleLine,
  ChartLineUp,
  GearSix,
  SignOut,
  Moon,
  Sun,
} from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

const NAV: { icon: PhosphorIcon; label: string; href: string }[] = [
  { icon: House, label: 'Dashboard', href: '' },
  { icon: PencilSimpleLine, label: 'Editor', href: '/editor' },
  { icon: ChartLineUp, label: 'Analytics', href: '/analytics' },
  { icon: GearSix, label: 'Settings', href: '/settings' },
]

export default function WorkspaceSidebar({ companyId }: { companyId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const base = `/company/${companyId}`
  const [user, setUser] = useState<{ name?: string; email?: string; image?: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    authClient.getSession().then(({ data }) => data?.user && setUser(data.user))
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

        {/* User */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger className="size-9 rounded-xl bg-muted/60 flex items-center justify-center text-xs font-medium overflow-hidden hover:bg-muted hover:rounded-lg transition-all duration-200 focus-visible:outline-none">
            {user?.image ? (
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              initial
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={8} className="min-w-40">
            <div className="px-2.5 py-1.5">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard')}>
              <House className="size-3.5" /> All projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? (
                <Sun className="size-3.5" />
              ) : (
                <Moon className="size-3.5" />
              )}
              {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
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
    </TooltipProvider>
  )
}
