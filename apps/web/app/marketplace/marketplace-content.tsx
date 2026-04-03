'use client'

import { ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink, ShoppingBag } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SurgentLogo } from '@/components/surgent-logo'
import { formatPrice } from '@/components/payments/utils'
import { authClient } from '@/lib/auth-client'
import { formatMarketplaceDate } from '@/lib/format'
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
      className="group flex items-center gap-4 rounded-xl p-3.5 transition-all duration-200 border border-transparent hover:bg-[#1d1c220d] dark:hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Thumbnail */}
        <div className="h-12 w-12 rounded-xl shrink-0 overflow-hidden bg-[#f0f0f0] dark:bg-muted/40 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] text-[#b0b1b3] font-medium">
              {listing.title.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1c22] dark:text-foreground truncate">
              {listing.title}
            </h3>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#b0b1b3] group-hover:text-[#475467] dark:group-hover:text-muted-foreground transition-colors" />
          </div>
          {listing.description && (
            <p className="text-[13px] text-[#475467] dark:text-muted-foreground truncate">
              {listing.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-2">
        {/* Price */}
        <div className="flex flex-col items-end min-w-[70px]">
          <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
            Price
          </p>
          {listing.priceAmount != null && listing.priceAmount > 0 ? (
            <span className="text-[14px] font-semibold text-[#1d1c22] dark:text-foreground">
              {formatPrice(listing.priceAmount, listing.priceCurrency || 'usd')}
            </span>
          ) : (
            <span className="text-[14px] font-semibold text-emerald-500">Free</span>
          )}
        </div>

        {/* Seller */}
        <div className="hidden sm:flex flex-col items-end min-w-[90px]">
          <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
            Seller
          </p>
          <div className="flex items-center gap-1.5">
            {listing.sellerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.sellerImage} alt="" className="h-4 w-4 rounded-full object-cover" />
            ) : null}
            <span className="text-[13px] text-[#475467] dark:text-muted-foreground truncate max-w-[80px]">
              {listing.sellerName}
            </span>
          </div>
        </div>

        {/* Live */}
        {listing.liveUrl && (
          <div className="hidden lg:flex flex-col items-end min-w-[40px]">
            <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
              Demo
            </p>
            <ExternalLink className="h-3.5 w-3.5 text-[#475467] dark:text-muted-foreground" />
          </div>
        )}

        {/* Date */}
        <div className="hidden md:flex flex-col items-end min-w-[70px]">
          <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
            Listed
          </p>
          <span className="text-[13px] text-[#475467] dark:text-muted-foreground">
            {formatMarketplaceDate(listing.updatedAt)}
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

        {/* ─── List ─── */}
        {isLoading ? (
          <div className="space-y-2 pb-14">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#1d1c220d] dark:border-border/20 bg-white dark:bg-card p-3.5 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#f0f0f0] dark:bg-muted/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 rounded bg-[#f0f0f0] dark:bg-muted/40" />
                    <div className="h-3 w-72 rounded bg-[#f0f0f0] dark:bg-muted/30" />
                  </div>
                  <div className="hidden sm:block h-8 w-16 rounded bg-[#f0f0f0] dark:bg-muted/30" />
                  <div className="h-8 w-16 rounded bg-[#f0f0f0] dark:bg-muted/30" />
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
            <div className="space-y-1">
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
