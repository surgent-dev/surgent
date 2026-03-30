'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Package, ArrowRight, CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateShort } from '@/lib/format'
import { usePurchasesQuery, type Purchase } from '@/queries/purchases'

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; color: string }> = {
  pending: { icon: Clock, label: 'Pending', color: 'text-yellow-600' },
  provisioning: { icon: Loader2, label: 'Setting up...', color: 'text-blue-600' },
  fulfilled: { icon: CheckCircle2, label: 'Ready', color: 'text-emerald-600' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-red-600' },
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const config = STATUS_CONFIG[purchase.status] ?? STATUS_CONFIG.pending!
  const Icon = config!.icon

  return (
    <Link
      href={
        purchase.status === 'fulfilled' && purchase.projectId
          ? `/project/${purchase.projectId}`
          : `/marketplace/purchases/${purchase.id}`
      }
      className="group flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border hover:bg-accent/30"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
          <Package className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">Purchase</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {purchase.createdAt ? formatDateShort(purchase.createdAt) : 'Just now'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config!.color}`}>
          <Icon
            className={`size-3.5 ${purchase.status === 'provisioning' ? 'animate-spin' : ''}`}
          />
          {config!.label}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

export default function PurchasesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string; image?: string } | null>(null)
  const { data: purchases, isLoading } = usePurchasesQuery()

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) {
        router.push('/login')
        return
      }
      setUser(data.user as any)
    })
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full px-6 h-14 flex items-center border-b">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <BrandLogo />
            </Link>
            <span className="text-border shrink-0">/</span>
            <Link
              href="/marketplace"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Marketplace
            </Link>
            <span className="text-border shrink-0">/</span>
            <span className="text-sm font-medium">My Purchases</span>
          </div>
          {user && (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user.image} />
              <AvatarFallback className="text-xs bg-muted">
                {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-6">
        <h1 className="text-lg font-semibold tracking-tight">My Purchases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Apps you&apos;ve acquired from the marketplace
        </p>

        <div className="mt-6 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg" />
            ))
          ) : !purchases?.length ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-16">
              <Package className="size-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No purchases yet</p>
              <Button asChild variant="outline" size="sm" className="mt-4 h-8 text-xs">
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          ) : (
            purchases.map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} />)
          )}
        </div>
      </main>
    </div>
  )
}
