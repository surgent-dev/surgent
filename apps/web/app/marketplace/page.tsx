'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarketplaceListingsQuery } from '@/queries/marketplace'

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

function formatDate(dateIso: string | null) {
  if (!dateIso) return 'Recently'
  const d = new Date(dateIso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays < 1) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MarketplacePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { data: listings = [], isLoading } = useMarketplaceListingsQuery(60)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setUser(data.user as User)
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
        <main className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border overflow-hidden">
                <Skeleton className="aspect-video rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
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
              <Image
                src="/surgent-logo.png"
                alt="Surgent"
                width={119}
                height={32}
                className="h-7 w-auto"
                priority
              />
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

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="mb-6">
          <p className="text-xs text-muted-foreground">Browse templates from other builders</p>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center bg-muted/10">
            <p className="text-sm text-muted-foreground">
              No listings yet. Deploy a project to list it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <Link
                key={listing.id || listing.projectId}
                href={`/marketplace/${listing.id}`}
                className="group rounded-lg border bg-card overflow-hidden hover:border-foreground/15 transition-shadow duration-200 hover:shadow-md"
              >
                {listing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.imageUrl}
                    alt={listing.title}
                    className="w-full aspect-video object-cover border-b"
                  />
                ) : (
                  <div className="w-full aspect-video bg-muted/30 border-b flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/40">No preview</span>
                  </div>
                )}
                <div className="p-4">
                  <h2 className="text-sm font-medium truncate group-hover:text-foreground">
                    {listing.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {listing.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={listing.sellerImage || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {listing.sellerName?.charAt(0)?.toUpperCase() || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">
                        {listing.sellerName}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground/60 shrink-0">
                      {formatDate(listing.updatedAt)}
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
