'use client'

import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SurgentLogo } from '@/components/surgent-logo'
import { formatPrice } from '@/components/payments/utils'
import { authClient } from '@/lib/auth-client'
import {
  type MarketplaceListing,
  type MarketplaceListingsResponse,
  useMarketplaceListingsQuery,
} from '@/queries/marketplace'

/* ─── Constants ─── */

const PER_PAGE = 30

const NAV_LINK =
  'font-display text-[0.9rem] font-medium text-[#1d1c22] dark:text-foreground transition-all px-4 py-2 rounded-full hover:bg-[#1d1c220d]'
const PAGE_BTN =
  'inline-flex items-center gap-1.5 rounded-full border border-[#1d1c220d] dark:border-border/20 bg-white dark:bg-card px-4 py-2 text-sm font-medium text-[#1d1c22] dark:text-foreground disabled:opacity-40 hover:bg-[#1d1c220d] transition-colors cursor-pointer'
const FOOTER_LINK =
  'text-[13px] text-[#1d1c22]/80 dark:text-foreground/80 hover:text-[#1d1c22] dark:hover:text-foreground transition-colors'

const FOOTER_COLS = [
  {
    title: 'Product',
    links: [
      { href: '/inspirations', label: 'Inspirations' },
      { href: '/marketplace', label: 'Marketplace' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/signup', label: 'Get Started' },
      { href: '/login', label: 'Log In' },
    ],
  },
  {
    title: 'Connect',
    external: true,
    links: [
      { href: 'https://x.com/surgentdev', label: 'X (Twitter)' },
      { href: 'https://instagram.com/surgentdev', label: 'Instagram' },
      { href: 'https://discord.gg/surgentdev', label: 'Discord' },
      { href: 'https://linkedin.com/company/surgent', label: 'LinkedIn' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
]

/* ─── Components ─── */

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <Link
      href={`/marketplace/${listing.id ?? listing.projectId}`}
      className="group flex flex-col rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#e8e8ea] dark:bg-muted/30">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt=""
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#e8e8ea] to-[#d8d8dc] dark:from-muted/30 dark:to-muted/50">
            <span className="text-5xl font-light text-[#c0c0c4] dark:text-muted-foreground/30 select-none">
              {listing.title.charAt(0)}
            </span>
          </div>
        )}
        {/* Price badge */}
        <div className="absolute bottom-3 right-3">
          {listing.priceAmount != null && listing.priceAmount > 0 ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-white/80 dark:bg-black/50 backdrop-blur-md text-[#1d1c22] dark:text-white">
              {formatPrice(listing.priceAmount, listing.priceCurrency || 'usd')}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-white/80 dark:bg-black/50 backdrop-blur-md text-emerald-600 dark:text-emerald-400">
              Free
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="pt-3 pb-1 px-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.01em] text-[#1d1c22] dark:text-foreground truncate">
          {listing.title}
        </h3>
        {listing.description && (
          <p className="mt-0.5 text-[13px] text-[#8a8a8e] dark:text-muted-foreground line-clamp-1">
            {listing.description}
          </p>
        )}

        {/* Seller */}
        <div className="flex items-center gap-1.5 mt-2">
          {listing.sellerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.sellerImage}
              alt=""
              className="h-4 w-4 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-4 w-4 rounded-full bg-[#e8e8ea] dark:bg-muted/40 shrink-0 flex items-center justify-center text-[8px] font-medium text-[#b0b1b3]">
              {listing.sellerName?.charAt(0)}
            </div>
          )}
          <span className="text-[12px] text-[#8a8a8e] dark:text-muted-foreground truncate">
            {listing.sellerName}
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Main ─── */

type MarketplaceContentProps = {
  searchParams: { page?: string }
  initialData?: MarketplaceListingsResponse | null
}

export default function MarketplaceContent({
  searchParams,
  initialData = null,
}: MarketplaceContentProps) {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    authClient.getSession().then(({ data }) => setIsLoggedIn(!!data?.user))
  }, [])
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const currentPage = Number(searchParams.page) || 1
  const listingsQuery = useMarketplaceListingsQuery(PER_PAGE, currentPage)
  const data = listingsQuery.data ?? initialData ?? undefined
  const isLoading = listingsQuery.isLoading && initialData == null && !listingsQuery.data
  const listings = data?.listings ?? []
  const pagination = data?.pagination

  function go(updates: Record<string, string | undefined>) {
    const qp = new URLSearchParams()
    const merged = { page: searchParams.page, ...updates }
    for (const [k, v] of Object.entries(merged)) {
      if (v) qp.set(k, v)
    }
    if (!updates.page) qp.delete('page')
    router.push(`/marketplace?${qp.toString()}`)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f5f5f7] dark:bg-background text-foreground">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 pt-4 pb-2 transition-all duration-300">
        <div
          className={`flex items-center justify-between w-full mx-auto transition-all duration-300 ease-out ${scrolled ? 'max-w-3xl border border-[#1d1c220d] dark:border-border/20 bg-[#f5f5f7]/85 dark:bg-card/85 backdrop-blur-2xl rounded-full px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]' : 'max-w-5xl px-3 py-2.5'}`}
        >
          <Link href="/" className="pl-3">
            <SurgentLogo className="text-[1.5rem]" />
          </Link>
          <nav className="hidden sm:flex items-center gap-0">
            <Link href="/" className={NAV_LINK}>
              Home
            </Link>
            <Link href="/inspirations" className={NAV_LINK}>
              Inspirations
            </Link>
            <Link href="/marketplace" className={NAV_LINK}>
              Marketplace
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="btn-brand inline-flex items-center h-9 px-5 rounded-full font-display text-[0.9rem] font-medium cursor-pointer"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="btn-brand-secondary inline-flex items-center h-9 px-4 rounded-full font-display text-[0.9rem] font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="btn-brand inline-flex items-center h-9 px-5 rounded-full font-display text-[0.9rem] font-medium cursor-pointer"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 w-full flex-1">
        {/* ─── Hero ─── */}
        <div className="pt-20 sm:pt-28 pb-12 text-center">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#b0b1b3] mb-3">
            Marketplace
          </p>
          <h1 className="font-display text-[2.25rem] sm:text-[3rem] lg:text-[3.75rem] leading-[1.15] tracking-[-0.04em] font-medium text-[#1d1c22] dark:text-foreground mb-4">
            Buy &amp; sell what&apos;s built
          </h1>
          <p className="text-[15px] text-[#475467] dark:text-muted-foreground">
            {pagination ? pagination.total.toLocaleString() : '...'} templates and projects from the
            community
          </p>
        </div>

        {/* ─── Count ─── */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="hidden sm:flex items-center gap-2 text-[13px] text-[#b0b1b3]">
            <ShoppingBag className="h-4 w-4" />
            {pagination ? `${pagination.total.toLocaleString()} listings` : 'Loading...'}
          </div>
        </div>

        {/* ─── Grid ─── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8 pb-14">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[16/10] rounded-xl bg-[#e8e8ea] dark:bg-muted/30" />
                <div className="pt-3 space-y-2 px-0.5">
                  <div className="h-4 w-3/5 rounded bg-[#e8e8ea] dark:bg-muted/30" />
                  <div className="h-3 w-4/5 rounded bg-[#ededef] dark:bg-muted/20" />
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div className="h-4 w-4 rounded-full bg-[#e8e8ea] dark:bg-muted/30" />
                    <div className="h-3 w-16 rounded bg-[#ededef] dark:bg-muted/20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 sm:py-32 text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white dark:bg-card border border-[#1d1c220d] dark:border-border/20 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] mb-6">
              <ShoppingBag className="h-7 w-7 text-[#b0b1b3]" />
            </div>
            <h2 className="font-display text-[1.25rem] sm:text-[1.5rem] tracking-[-0.02em] font-medium text-[#1d1c22] dark:text-foreground mb-2">
              Marketplace is warming up
            </h2>
            <p className="text-[14px] text-[#475467] dark:text-muted-foreground max-w-sm mb-8 leading-relaxed">
              Listings from the community will show up here. Build something with Surgent and be the
              first to list.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/signup"
                className="btn-brand inline-flex items-center h-10 px-6 rounded-full font-display text-[0.9rem] font-medium cursor-pointer"
              >
                Start building
              </Link>
              <Link
                href="/inspirations"
                className="inline-flex items-center h-10 px-5 rounded-full font-display text-[0.9rem] font-medium text-[#1d1c22] dark:text-foreground border border-[#1d1c220d] dark:border-border/20 bg-white dark:bg-card hover:bg-[#1d1c220d] transition-colors cursor-pointer"
              >
                Browse inspirations
              </Link>
            </div>
          </div>
        ) : (
          <div className="pb-14">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
              {listings.map((l) => (
                <ListingCard key={l.id || l.projectId} listing={l} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() =>
                    go({ page: currentPage > 1 ? String(currentPage - 1) : undefined })
                  }
                  disabled={currentPage <= 1}
                  className={PAGE_BTN}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="px-3 text-sm text-[#b0b1b3]">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    go({
                      page:
                        currentPage < pagination.totalPages ? String(currentPage + 1) : undefined,
                    })
                  }
                  disabled={currentPage >= pagination.totalPages}
                  className={PAGE_BTN}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-[#1d1c220d] dark:border-border/15">
        <div className="px-6 sm:px-10">
          <div className="max-w-5xl mx-auto py-12 sm:py-16">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-5 lg:gap-12">
              <div className="col-span-2 sm:col-span-1">
                <Link href="/" className="inline-flex items-center gap-1.5">
                  <Image
                    src="/surgent-coin.svg"
                    alt=""
                    width={22}
                    height={22}
                    className="size-[22px] dark:invert shrink-0"
                  />
                  <SurgentLogo className="text-lg" />
                </Link>
                <p className="mt-3 text-[13px] text-[#b0b1b3] leading-relaxed max-w-[200px]">
                  AI that builds and grows your business.
                </p>
              </div>
              {FOOTER_COLS.map((col) => (
                <nav key={col.title}>
                  <p className="text-[13px] font-medium text-[#b0b1b3] mb-3">{col.title}</p>
                  <ul className="space-y-2.5">
                    {col.links.map((l) => (
                      <li key={l.href}>
                        {col.external ? (
                          <a
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={FOOTER_LINK}
                          >
                            {l.label}
                          </a>
                        ) : (
                          <Link href={l.href} className={FOOTER_LINK}>
                            {l.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
            <div className="mt-12 pt-6 border-t border-[#1d1c220d] dark:border-border/15 text-[12px] text-[#b0b1b3]">
              &copy; {new Date().getFullYear()} Surgent. All rights reserved.
            </div>
          </div>
        </div>
        <div className="overflow-hidden pointer-events-none select-none" aria-hidden="true">
          <div className="text-center pb-2">
            <span className="font-display text-[14vw] sm:text-[12vw] lg:text-[10vw] font-bold tracking-tighter leading-none text-[#1d1c22]/[0.03] dark:text-foreground/[0.03]">
              surgent
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
