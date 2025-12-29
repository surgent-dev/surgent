'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import Image from 'next/image'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Store, CreditCard, Search, Clock, X, Layers, Briefcase, Palette, Gamepad2, GraduationCap, Heart, Loader2 } from 'lucide-react'
import { useBrowseProducts, useCheckout } from '@/queries/marketplace'
import { useCustomer } from 'autumn-js/react'

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

const categories = [
  { id: 'All', icon: Layers },
  { id: 'Tools', icon: Briefcase },
  { id: 'Design', icon: Palette },
  { id: 'Games', icon: Gamepad2 },
  { id: 'Education', icon: GraduationCap },
  { id: 'Lifestyle', icon: Heart },
]

function formatPrice(amount: number | string, currency: string) {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `${symbols[currency] || currency}${num.toFixed(2)}`
}

export default function MarketplacePage() {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const { data: products = [], isLoading } = useBrowseProducts()
  const { customer } = useCustomer()
  const checkoutMutation = useCheckout()

  const handleBuy = async (productId: string, priceId: string | null, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!priceId) return toast.error('No price available')
    try {
      const result = await checkoutMutation.mutateAsync({ productId, priceId, redirectUrl: window.location.href })
      window.location.href = result.purchaseUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    }
  }

  // ⌘K to focus search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    authClient.getSession().then(({ data, error }) => {
      if (error || !data?.user) return router.push('/login')
      setUser(data.user as User)
    })
  }, [router])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.merchantName.toLowerCase().includes(q)
    )
  }, [products, search])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex h-14 items-center gap-8">
            <Link href="/" className="shrink-0">
              <Image src="/surgent-logo.svg" alt="Surgent" width={100} height={26} className="h-6 w-auto" priority />
            </Link>

            <div className="relative flex-1 max-w-xs group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 group-focus-within:text-foreground transition-colors" />
              <Input
                ref={searchRef}
                placeholder="Search apps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 pr-9 bg-muted/40 border border-transparent rounded-lg text-sm placeholder:text-muted-foreground/50 hover:bg-muted/60 focus:bg-background focus:border-border focus-visible:ring-2 focus-visible:ring-brand/10 transition-all"
              />
              {search ? (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3" />
                </button>
              ) : (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground/60">
                  ⌘K
                </kbd>
              )}
            </div>

            <div className="flex items-center ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="outline-none">
                    <Avatar className="size-8">
                      <AvatarImage src={user?.image} />
                      <AvatarFallback className="bg-muted text-xs font-medium">
                        {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <p className="font-medium truncate">{user?.name || user?.email}</p>
                    {customer && <p className="text-xs text-muted-foreground font-normal">{customer.products[0]?.name || 'Free'}</p>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>Dashboard</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/pricing')}>
                    <CreditCard className="mr-2 size-4" />Billing
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Categories */}
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            {categories.map(({ id, icon: Icon }) => {
              const isActive = activeCategory === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveCategory(id)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {id}
                  {/* Active indicator with glow */}
                  <span
                    className={cn(
                      "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-brand transition-all",
                      isActive ? "w-4/5 opacity-100" : "w-0 opacity-0"
                    )}
                  />
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-4 bg-brand/20 blur-md rounded-full pointer-events-none" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-4/3 rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Store className="size-10 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
            <p className="font-medium">{search ? 'No results found' : 'No apps yet'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? `Nothing matches "${search}"` : 'Check back soon'}
            </p>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-4">
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                target="_blank"
                className="group cursor-pointer block"
              >
                <div className="aspect-4/3 rounded-xl bg-muted/20 border overflow-hidden mb-3 relative">
                  {product.metadata?.thumbnailUrl ? (
                    <img
                      src={product.metadata.thumbnailUrl}
                      alt={product.title}
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Store className="size-8 text-muted-foreground/20" strokeWidth={1.5} />
                    </div>
                  )}
                  {product.priceAmount != null && product.priceCurrency && (
                    <span className="absolute top-2.5 right-2.5 z-10 text-xs font-semibold bg-background/90 backdrop-blur px-2 py-0.5 rounded-full border">
                      {formatPrice(product.priceAmount, product.priceCurrency)}
                    </span>
                  )}
                  {product.priceId && (
                    <Button
                      size="sm"
                      className="absolute bottom-2.5 right-2.5 z-10 h-7 text-xs rounded-full opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
                      disabled={checkoutMutation.isPending}
                      onClick={(e) => handleBuy(product.id, product.priceId, e)}
                    >
                      {checkoutMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Buy'}
                    </Button>
                  )}
                </div>
                <h3 className="font-medium text-sm group-hover:text-brand transition-colors line-clamp-1">
                  {product.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {product.description || 'No description'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1.5">
                  <span>{product.merchantName}</span>
                  <span>·</span>
                  <Clock className="size-3" />
                  {formatDistanceToNow(new Date(product.createdAt), { addSuffix: true })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Toaster position="top-right" />
    </div>
  )
}
