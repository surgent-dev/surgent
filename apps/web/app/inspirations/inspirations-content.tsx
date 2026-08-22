'use client'

import {
  ArrowUpRight,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Cpu,
  DollarSign,
  Gamepad2,
  Headphones,
  Layers,
  Leaf,
  Lock,
  MessageCircle,
  Newspaper,
  Plane,
  Scale,
  Share2,
  Store,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  AiIcon,
  AllIcon,
  AnalyticsIcon,
  ContentIcon,
  DesignIcon,
  DevIcon,
  EcommerceIcon,
  EducationIcon,
  FintechIcon,
  HealthIcon,
  MarketingIcon,
  MobileIcon,
  ProductivityIcon,
  SaasIcon,
} from '@/components/icons/category-icons'
import { SurgentLogo } from '@/components/surgent-logo'
import { authClient } from '@/lib/auth-client'
import { passthroughImageLoader } from '@/lib/image-loader'
import { formatRevenueCompact, getDomainFromUrl } from '@/lib/inspirations'
import {
  buildInspirationsQueryParams,
  INSPIRATIONS_REVENUE_FILTERS,
  type InspirationsSearchParams,
} from '@/lib/inspirations-search'
import {
  type Startup,
  type StartupsResponse,
  useStartupCategoriesQuery,
  useStartupsQuery,
} from '@/queries/startups'

/* ─── Constants ─── */

type StartupCategory = { category: string | null; count: number }

const NAV_LINK =
  'font-display text-[0.9rem] font-medium text-[#1d1c22] dark:text-foreground transition-all px-4 py-2 rounded-full hover:bg-[#1d1c220d]'
const PILL_BASE =
  'rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all cursor-pointer'
const PILL_ON = 'bg-[#1d1c22] dark:bg-foreground text-white dark:text-background'
const PILL_OFF =
  'bg-white dark:bg-card text-[#1d1c22] dark:text-foreground border border-[#1d1c220d] dark:border-border/20 hover:bg-[#1d1c220d]'
const PAGE_BTN =
  'inline-flex items-center gap-1.5 rounded-full border border-[#1d1c220d] dark:border-border/20 bg-white dark:bg-card px-4 py-2 text-sm font-medium text-[#1d1c22] dark:text-foreground disabled:opacity-40 hover:bg-[#1d1c220d] transition-colors cursor-pointer'
const CARD_ACTIVE =
  'bg-white dark:bg-card border border-[#1d1c220d] dark:border-border/20 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]'
const CARD_IDLE = 'bg-white/60 dark:bg-card/60 border border-[#1d1c220d] dark:border-border/10'
const FOOTER_LINK =
  'text-[13px] text-[#1d1c22]/80 dark:text-foreground/80 hover:text-[#1d1c22] dark:hover:text-foreground transition-colors'

const CAT_ICONS: Record<string, React.ElementType> = {
  'Artificial Intelligence': AiIcon,
  SaaS: SaasIcon,
  'Developer Tools': DevIcon,
  Productivity: ProductivityIcon,
  Marketing: MarketingIcon,
  'Content Creation': ContentIcon,
  Education: EducationIcon,
  'Mobile Apps': MobileIcon,
  'Health & Fitness': HealthIcon,
  Fintech: FintechIcon,
  Analytics: AnalyticsIcon,
  'Design Tools': DesignIcon,
  Utilities: Wrench,
  'E-commerce': EcommerceIcon,
  'Social Media': Share2,
  'Recruiting & HR': Briefcase,
  Entertainment: Headphones,
  Marketplace: Store,
  Community: MessageCircle,
  Sales: DollarSign,
  'Real Estate': Building2,
  Games: Gamepad2,
  'Customer Support': Headphones,
  'No-Code': Layers,
  Security: Lock,
  Travel: Plane,
  'News & Magazines': Newspaper,
  'Crypto & Web3': Coins,
  'IoT & Hardware': Cpu,
  Legal: Scale,
  'Green Tech': Leaf,
}

const CAT_COLORS: Record<string, string> = {
  'Artificial Intelligence': '#b48efe',
  SaaS: '#60a5fa',
  'Developer Tools': '#34d399',
  Productivity: '#fbbf24',
  Marketing: '#f472b6',
  'Content Creation': '#fb923c',
  Education: '#818cf8',
  'Mobile Apps': '#38bdf8',
  'Health & Fitness': '#fb7185',
  Fintech: '#2dd4bf',
  Analytics: '#c084fc',
  'Design Tools': '#e879f9',
  'E-commerce': '#a3e635',
}

const BENTO = [
  'col-span-1',
  'col-span-1 sm:col-span-2 lg:col-span-2',
  'col-span-1',
  'col-span-1',
  'col-span-1',
  'col-span-1 sm:col-span-2 lg:col-span-2',
  'col-span-1',
  'col-span-1',
  'col-span-1',
  'col-span-1',
  'col-span-1 sm:col-span-2 lg:col-span-2',
  'col-span-1',
  'col-span-1 sm:col-span-3 lg:col-span-1',
]

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

function StartupCard({ startup }: { startup: Startup }) {
  const hasGrowth = startup.growth30d != null && startup.growth30d > 0
  return (
    <Link
      href={`/inspirations/${startup.slug}`}
      className="group flex items-center gap-4 rounded-xl p-3.5 transition-all duration-200 border border-transparent hover:bg-[#1d1c220d] dark:hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Image
          loader={passthroughImageLoader}
          unoptimized
          src={startup.icon!}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-xl object-cover shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1c22] dark:text-foreground truncate">
              {startup.name}
            </h3>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#b0b1b3] group-hover:text-[#475467] dark:group-hover:text-muted-foreground transition-colors" />
            {startup.category && (
              <span className="ml-1 text-[11px] text-[#475467] dark:text-muted-foreground bg-white dark:bg-card px-1.5 py-[1px] rounded-md border border-[#1d1c220d] dark:border-border/20">
                {startup.category}
              </span>
            )}
          </div>
          {startup.description && (
            <p className="text-[13px] text-[#475467] dark:text-muted-foreground truncate">
              {startup.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-2">
        <Stat
          label="MRR"
          value={startup.revenueMrr > 0 ? formatRevenueCompact(startup.revenueMrr) : '—'}
          className="hidden sm:flex"
        />
        <Stat
          label="Total Rev"
          value={startup.revenueTotal > 0 ? formatRevenueCompact(startup.revenueTotal) : '—'}
          className="hidden md:flex"
        />
        <div className="flex flex-col items-end min-w-[90px]">
          <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
            Growth
          </p>
          <span
            className="text-[14px] font-semibold inline-flex items-center gap-1"
            style={{ color: hasGrowth ? '#10b981' : '#b0b1b3' }}
          >
            {hasGrowth && <TrendingUp className="h-3.5 w-3.5" />}
            {startup.growth30d != null
              ? `${startup.growth30d > 0 ? '+' : ''}${startup.growth30d.toFixed(0)}%`
              : '—'}
          </span>
        </div>
        <div className="hidden lg:flex flex-col items-end min-w-[120px]">
          <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
            Website
          </p>
          <span className="text-[13px] text-[#475467] dark:text-muted-foreground truncate max-w-[120px]">
            {getDomainFromUrl(startup.website || '')}
          </span>
        </div>
      </div>
    </Link>
  )
}

function Stat({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`flex-col items-end min-w-[70px] ${className}`}>
      <p className="text-[10px] text-[#b0b1b3] uppercase tracking-wider font-semibold mb-0.5">
        {label}
      </p>
      <span className="text-[14px] font-semibold text-[#1d1c22] dark:text-foreground">{value}</span>
    </div>
  )
}

/* ─── Main ─── */

type InspirationsContentProps = {
  searchParams: InspirationsSearchParams
  initialData?: StartupsResponse | null
  initialCategories?: StartupCategory[] | null
}

export default function InspirationsContent({
  searchParams,
  initialData = null,
  initialCategories = null,
}: InspirationsContentProps) {
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

  const params = buildInspirationsQueryParams(searchParams)
  const activeRevFilter =
    INSPIRATIONS_REVENUE_FILTERS.find((f) => f.value === (searchParams.rev || 'top')) ??
    INSPIRATIONS_REVENUE_FILTERS[0]!
  const startupsQuery = useStartupsQuery(params)
  const categoriesQuery = useStartupCategoriesQuery()
  const data = startupsQuery.data ?? initialData ?? undefined
  const categories = categoriesQuery.data ?? initialCategories ?? undefined
  const isLoading = startupsQuery.isLoading && initialData == null && !startupsQuery.data
  const pagination = data?.pagination
  const startups = data?.startups ?? []
  const activeCategory = searchParams.category || null

  function go(updates: Record<string, string | undefined>) {
    const qp = new URLSearchParams()
    const merged = {
      category: searchParams.category,
      rev: searchParams.rev,
      page: searchParams.page,
      ...updates,
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v) qp.set(k, v)
    }
    if (!updates.page) qp.delete('page')
    router.push(`/inspirations?${qp.toString()}`)
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
            Inspirations
          </p>
          <h1 className="font-display text-[2.25rem] sm:text-[3rem] lg:text-[3.75rem] leading-[1.15] tracking-[-0.04em] font-medium text-[#1d1c22] dark:text-foreground mb-4">
            Explore what&apos;s working
          </h1>
          <div className="flex items-center justify-center flex-wrap gap-2">
            <p className="text-[15px] text-[#475467] dark:text-muted-foreground">
              {pagination ? pagination.total.toLocaleString() : '...'} startups with verified
              revenue
            </p>
            <span className="text-[#d4d4d4] hidden sm:inline">|</span>
            <a
              href="https://trustmrr.com"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 text-[13px] text-[#b0b1b3] hover:text-[#1d1c22] dark:hover:text-foreground transition-colors"
            >
              Powered by TrustMRR{' '}
              <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>

        {/* ─── Categories ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 pb-8 mb-8 border-b border-[#1d1c220d] dark:border-border/15">
          <CatCard
            label="All Categories"
            count={pagination?.total}
            icon={AllIcon}
            iconColor="#1d1c22"
            active={!activeCategory}
            onClick={() => go({ category: undefined, page: undefined })}
            span={BENTO[0]!}
          />
          {categories?.slice(0, 12).map((cat, i) => {
            const isActive = activeCategory === cat.category
            return (
              <CatCard
                key={cat.category}
                label={cat.category!}
                count={cat.count}
                icon={(cat.category && CAT_ICONS[cat.category]) || Layers}
                iconColor={cat.category ? CAT_COLORS[cat.category] || '#b0b1b3' : '#b0b1b3'}
                active={isActive}
                onClick={() =>
                  go({ category: isActive ? undefined : cat.category!, page: undefined })
                }
                span={BENTO[i + 1] || 'col-span-1'}
              />
            )
          })}
        </div>

        {/* ─── Filters ─── */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {INSPIRATIONS_REVENUE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => go({ rev: f.value, page: undefined })}
                className={`${PILL_BASE} ${activeRevFilter.value === f.value ? PILL_ON : PILL_OFF}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[13px] text-[#b0b1b3]">
            <Users className="h-4 w-4" />
            {pagination ? `${pagination.total.toLocaleString()} results` : 'Loading...'}
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
        ) : startups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1d1c220d] dark:border-border/20 p-16 text-center">
            <p className="text-[14px] text-[#475467] dark:text-muted-foreground">
              No startups found for this filter.
            </p>
          </div>
        ) : (
          <div className="pb-14">
            <div className="space-y-1">
              {startups.map((s) => (
                <StartupCard key={s.slug} startup={s} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() =>
                    go({
                      page: params.page && params.page > 1 ? String(params.page - 1) : undefined,
                    })
                  }
                  disabled={!params.page || params.page <= 1}
                  className={PAGE_BTN}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="px-3 text-sm text-[#b0b1b3]">
                  Page {params.page || 1} of {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    go({
                      page:
                        params.page && params.page < pagination.totalPages
                          ? String(params.page + 1)
                          : undefined,
                    })
                  }
                  disabled={!params.page || params.page >= pagination.totalPages}
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

/* ─── Category card ─── */

function CatCard({
  label,
  count,
  icon: Icon,
  iconColor,
  active,
  onClick,
  span,
}: {
  label: string
  count?: number
  icon: React.ElementType
  iconColor: string
  active: boolean
  onClick: () => void
  span: string
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden flex flex-col items-start justify-between p-5 sm:p-6 rounded-2xl transition-all duration-200 cursor-pointer hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] ${span}`}
      style={{ minHeight: '130px' }}
    >
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-200 ${active ? CARD_ACTIVE : CARD_IDLE}`}
      />
      <div className="relative z-10 flex flex-col items-start gap-1">
        <span className="font-display text-[17px] sm:text-[19px] tracking-tight font-semibold text-[#1d1c22] dark:text-foreground">
          {label}
        </span>
        <span
          className={`text-[13px] font-medium ${active ? 'text-[#475467] dark:text-muted-foreground' : 'text-[#b0b1b3]'}`}
        >
          {count != null ? `${count.toLocaleString()} startups` : '...'}
        </span>
      </div>
      <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
        <Icon
          className="w-24 h-24 sm:w-32 sm:h-32"
          style={{ color: iconColor, opacity: active ? 0.18 : 0.08 }}
        />
      </div>
    </button>
  )
}
