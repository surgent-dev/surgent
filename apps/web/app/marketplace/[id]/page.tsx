'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarketplaceListingQuery } from '@/queries/marketplace'

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

function formatDate(dateIso: string | null) {
  if (!dateIso) return 'Recently listed'
  return new Date(dateIso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { data: listing, isLoading, error } = useMarketplaceListingQuery(id)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setUser(data.user as User)
    })
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="w-full px-6 h-14 flex items-center border-b">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto py-6 px-6 space-y-5">
          <Skeleton className="w-full h-64 rounded-lg" />
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </main>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Listing not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/marketplace')}>
          Back to Marketplace
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full px-6 h-14 flex items-center border-b">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image
                src="/surgent-logo.png"
                alt="Surgent"
                width={119}
                height={32}
                className="h-7 w-auto"
                priority
              />
            </Link>
            <span className="text-border shrink-0">/</span>
            <Link
              href="/marketplace"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Marketplace
            </Link>
            <span className="text-border shrink-0">/</span>
            <span className="text-sm font-medium truncate">{listing.title}</span>
          </div>
          {user ? (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user.image} />
              <AvatarFallback className="text-xs bg-muted">
                {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => router.push('/login')}
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-6 px-6">
        {/* Screenshot */}
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-auto max-h-80 object-cover rounded-lg border"
          />
        ) : (
          <div className="w-full h-48 bg-muted/30 rounded-lg border flex items-center justify-center">
            <span className="text-xs text-muted-foreground/40">No preview</span>
          </div>
        )}

        {/* Title + meta */}
        <div className="mt-5">
          <h1 className="text-xl font-semibold tracking-tight">{listing.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {listing.projectName} · Listed {formatDate(listing.updatedAt)}
          </p>
        </div>

        {/* Seller + live demo */}
        <div className="flex items-center justify-between mt-4 gap-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={listing.sellerImage || undefined} />
              <AvatarFallback className="text-[10px]">
                {listing.sellerName?.charAt(0)?.toUpperCase() || 'S'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{listing.sellerName}</span>
          </div>
          {listing.liveUrl && (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <a href={listing.liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Live demo
              </a>
            </Button>
          )}
        </div>

        {/* Description */}
        <div className="mt-5 border-t pt-5">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {listing.description}
          </p>
        </div>
      </main>
    </div>
  )
}
