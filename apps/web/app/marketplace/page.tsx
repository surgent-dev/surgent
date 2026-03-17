'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMarketplaceDate } from '@/lib/format'
import { useMarketplaceListingsQuery } from '@/queries/marketplace'
import { formatPrice } from '@/components/payments/utils'
import type { MarketplaceUser } from './types'

export default function MarketplacePage() {
  const router = useRouter()
  const [user, setUser] = useState<MarketplaceUser | null>(null)
  const { data: listings = [], isLoading } = useMarketplaceListingsQuery(60)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setUser(data.user as MarketplaceUser)
    })
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="w-full px-6 h-14 flex items-center border-b">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-lg font-semibold tracking-tight">Marketplace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse templates and projects from other builders
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[16/9] rounded-md" />
                <div className="space-y-2 px-0.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full px-6 h-14 flex items-center border-b">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
            <span className="text-border">/</span>
            <span className="text-sm font-medium">Marketplace</span>
          </div>
          {user ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image} />
              <AvatarFallback className="text-xs bg-muted">
                {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push('/login')}
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse templates and projects from other builders
          </p>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-16 text-center">
            <p className="text-sm text-muted-foreground">
              No listings yet. Deploy a project to list it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <Link
                key={listing.id || listing.projectId}
                href={`/marketplace/${listing.id ?? listing.projectId}`}
                className="group block"
              >
                {/* Screenshot */}
                <div className="rounded-md overflow-hidden border border-border/60 aspect-[16/9] bg-muted/30">
                  {listing.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/40">No preview</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="pt-3 px-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[15px] font-semibold leading-snug truncate">
                      {listing.title}
                    </h2>
                    {listing.priceAmount != null && listing.priceAmount > 0 ? (
                      <span className="text-xs font-semibold tabular-nums shrink-0 rounded-full bg-foreground/[0.06] px-2.5 py-1">
                        {formatPrice(listing.priceAmount, listing.priceCurrency || 'usd')}
                      </span>
                    ) : (
                      <span className="text-xs font-medium shrink-0 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-1">
                        Free
                      </span>
                    )}
                  </div>

                  {listing.description && (
                    <p className="text-[13px] text-muted-foreground mt-1 line-clamp-1">
                      {listing.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={listing.sellerImage || undefined} />
                      <AvatarFallback className="text-[9px]">
                        {listing.sellerName?.charAt(0)?.toUpperCase() || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">
                      {listing.sellerName}
                    </span>
                    <span className="text-xs text-muted-foreground/40 shrink-0 ml-auto">
                      {formatMarketplaceDate(listing.updatedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
