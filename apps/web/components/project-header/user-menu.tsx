'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { SignOut, CreditCard, Lightning, Sun, Moon } from '@phosphor-icons/react'
import { useCredits } from '@/hooks/use-credits'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

interface UserMenuProps {
  onUpgrade?: () => void
}

export default function UserMenu({ onUpgrade }: UserMenuProps) {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const credits = useCredits()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    authClient.getSession().then(({ data }) => data?.user && setUser(data.user as User))
  }, [])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="User menu">
          <Avatar className="size-6">
            <AvatarImage src={user?.image} alt={user?.name || user?.email} />
            <AvatarFallback className="bg-muted text-foreground text-[11px] font-medium">
              {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <div className="px-3 py-2">
          <div className="text-sm font-medium truncate">{user?.name || 'User'}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </div>
        <div className="h-px bg-border" />
        {credits.hasCustomer && !credits.unlimited && (
          <>
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Credits</span>
                <span className="text-xs tabular-nums font-medium">
                  {credits.used.toLocaleString()} / {credits.total.toLocaleString()}
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    credits.usedPercent >= 90
                      ? 'bg-rose-500'
                      : credits.usedPercent >= 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${credits.usedPercent}%` }}
                />
              </div>
              {!credits.isMaxPlan && (
                <button
                  onClick={() => onUpgrade?.()}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-brand/20 bg-brand/8 px-2.5 py-1.5 text-[11px] font-medium text-brand hover:bg-brand/12 active:translate-y-px transition-all duration-100"
                >
                  <Lightning className="size-3" weight="fill" />
                  Upgrade
                </button>
              )}
            </div>
            <div className="h-px bg-border" />
          </>
        )}
        <div className="px-1 py-1">
          <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
            {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
          </DropdownMenuItem>
        </div>
        <div className="h-px bg-border" />
        <div className="px-1 py-1">
          <DropdownMenuItem onClick={() => credits.openBillingPortal()}>
            <CreditCard className="size-4" weight="duotone" />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <SignOut className="size-4" weight="duotone" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
