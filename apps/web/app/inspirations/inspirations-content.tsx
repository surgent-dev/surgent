'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Geist, Geist_Mono } from 'next/font/google'
import { BrandLogo } from '@/components/brand-logo'
import { formatRevenueCompact, getDomainFromUrl } from '@/lib/inspirations'
import UserMenu from '@/components/project-header/user-menu'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  ArrowUpRight,
  Layers,
  Wrench,
  Share2,
  Briefcase,
  Headphones,
  Store,
  MessageCircle,
  DollarSign,
  Building2,
  Gamepad2,
  Lock,
  Plane,
  Newspaper,
  Coins,
  Cpu,
  Scale,
  Leaf,
} from 'lucide-react'
import {
  AllIcon,
  AiIcon,
  SaasIcon,
  DevIcon,
  ProductivityIcon,
  MarketingIcon,
  ContentIcon,
  EducationIcon,
  MobileIcon,
  HealthIcon,
  FintechIcon,
  AnalyticsIcon,
  DesignIcon,
  EcommerceIcon,
} from '@/components/icons/category-icons'
import {
  useStartupsQuery,
  useStartupCategoriesQuery,
  type StartupsQueryParams,
  type Startup,
} from '@/queries/startups'

type SearchParams = {
  category?: string
  page?: string
  rev?: string
}

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

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

const CAT_COLORS: Record<string, { icon: string }> = {
  'Artificial Intelligence': {
    icon: '#b48efe',
  },
  SaaS: {
    icon: '#60a5fa',
  },
  'Developer Tools': {
    icon: '#34d399',
  },
  Productivity: {
    icon: '#fbbf24',
  },
  Marketing: {
    icon: '#f472b6',
  },
  'Content Creation': {
    icon: '#fb923c',
  },
  Education: {
    icon: '#818cf8',
  },
  'Mobile Apps': {
    icon: '#38bdf8',
  },
  'Health & Fitness': {
    icon: '#fb7185',
  },
  Fintech: {
    icon: '#2dd4bf',
  },
  Analytics: {
    icon: '#c084fc',
  },
  'Design Tools': {
    icon: '#e879f9',
  },
  'E-commerce': {
    icon: '#a3e635',
  },
}

const DEFAULT_CAT_COLOR = {
  icon: 'var(--muted-foreground)',
}

function getCatColor(cat: string | null) {
  if (!cat) return DEFAULT_CAT_COLOR
  return CAT_COLORS[cat] || DEFAULT_CAT_COLOR
}

const REVENUE_FILTERS = [
  { label: 'Top Companies', value: 'top', min: undefined, max: undefined },
  { label: '$1k – $30k', value: '1k-30k', min: 1_000, max: 30_000 },
]

const BENTO_CLASSES = [
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-2 lg:col-span-2',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-2 lg:col-span-2',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-2 lg:col-span-2',
  'col-span-1 sm:col-span-1 lg:col-span-1',
  'col-span-1 sm:col-span-3 lg:col-span-1',
]

function StartupCard({ startup, index }: { startup: Startup; index: number }) {
  const hasGrowth = startup.growth30d != null && startup.growth30d > 0

  return (
    <Link
      href={`/inspirations/${startup.slug}`}
      className="group relative flex items-center gap-4 rounded-xl p-3.5 transition-all duration-300 animate-fade-in-up border border-transparent bg-transparent hover:bg-[var(--page-hover)]"
      style={{
        animationFillMode: 'both',
        animationDelay: `${index * 0.05}s`,
      }}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <img
          src={startup.icon!}
          alt=""
          className="h-12 w-12 rounded-xl object-cover shrink-0 transition-transform duration-500 group-hover:scale-[1.02]"
          style={{ boxShadow: 'var(--shadow-surface-xs)' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3
              className="text-[15px] text-foreground truncate"
              style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              {startup.name}
            </h3>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--page-muted-faint)] group-hover:text-muted-foreground transition-colors duration-150" />
            {startup.category && (
              <span className="ml-1 text-[11px] text-muted-foreground bg-[var(--page-panel)] px-1.5 py-[1px] rounded-md border border-[var(--page-line-soft)]">
                {startup.category}
              </span>
            )}
          </div>
          {startup.description && (
            <p
              className="text-[13px] text-muted-foreground truncate"
              style={{ letterSpacing: '-0.005em' }}
            >
              {startup.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-2">
        <div className="hidden sm:flex flex-col items-end min-w-[70px]">
          <p className="text-[10px] text-[var(--page-muted-soft)] uppercase tracking-wider font-semibold mb-0.5">
            MRR
          </p>
          <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
            {startup.revenueMrr > 0 ? formatRevenueCompact(startup.revenueMrr) : '—'}
          </span>
        </div>

        <div className="hidden md:flex flex-col items-end min-w-[80px]">
          <p className="text-[10px] text-[var(--page-muted-soft)] uppercase tracking-wider font-semibold mb-0.5">
            Total Rev
          </p>
          <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
            {startup.revenueTotal > 0 ? formatRevenueCompact(startup.revenueTotal) : '—'}
          </span>
        </div>

        <div className="flex flex-col items-end min-w-[90px]">
          <p className="text-[10px] text-[var(--page-muted-soft)] uppercase tracking-wider font-semibold mb-0.5">
            Growth
          </p>
          <span
            className="text-[14px] inline-flex items-center gap-1"
            style={{
              fontWeight: 600,
              color: hasGrowth ? '#10b981' : 'var(--muted-foreground)',
            }}
          >
            {hasGrowth ? <TrendingUp className="h-3.5 w-3.5" /> : null}
            {startup.growth30d != null
              ? `${startup.growth30d > 0 ? '+' : ''}${startup.growth30d.toFixed(0)}%`
              : '—'}
          </span>
        </div>

        <div className="hidden lg:flex flex-col items-end min-w-[120px]">
          <p className="text-[10px] text-[var(--page-muted-soft)] uppercase tracking-wider font-semibold mb-0.5">
            Website
          </p>
          <span className="text-[13px] text-muted-foreground truncate max-w-[120px]">
            {getDomainFromUrl(startup.website || '')}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function InspirationsContent({ searchParams }: { searchParams: SearchParams }) {
  const router = useRouter()

  const revenueFilter = searchParams.rev || 'top'
  const activeRevFilter =
    REVENUE_FILTERS.find((f) => f.value === revenueFilter) ?? REVENUE_FILTERS[0]!

  const params: StartupsQueryParams = {
    page: Number(searchParams.page) || 1,
    perPage: 100,
    sort: 'revenue-desc',
    category: searchParams.category || undefined,
    minRevenue: activeRevFilter?.min,
    maxRevenue: activeRevFilter?.max,
  }

  const { data, isLoading } = useStartupsQuery(params)
  const { data: categories } = useStartupCategoriesQuery()

  function updateParams(updates: Record<string, string | undefined>) {
    const qp = new URLSearchParams()
    const current = {
      category: searchParams.category || undefined,
      rev: searchParams.rev || undefined,
      page: searchParams.page || undefined,
    }
    const merged = { ...current, ...updates }
    for (const [key, value] of Object.entries(merged)) {
      if (value) qp.set(key, value)
    }
    if (!updates.page) qp.delete('page')
    router.push(`/inspirations?${qp.toString()}`)
  }

  const pagination = data?.pagination
  const startups = data?.startups ?? []
  const activeCategory = searchParams.category || null
  const pageOffset = ((params.page ?? 1) - 1) * (params.perPage ?? 100)

  return (
    <div
      className={`min-h-screen bg-background text-foreground ${geist.variable} ${geistMono.variable}`}
      style={{
        fontFamily: 'var(--font-geist), system-ui, sans-serif',
        ['--page-header' as string]: 'color-mix(in srgb, var(--background) 84%, transparent)',
        ['--page-panel' as string]: 'color-mix(in srgb, var(--card) 94%, transparent)',
        ['--page-panel-strong' as string]: 'color-mix(in srgb, var(--card) 98%, transparent)',
        ['--page-line' as string]: 'color-mix(in srgb, var(--border) 70%, transparent)',
        ['--page-line-soft' as string]: 'color-mix(in srgb, var(--border) 50%, transparent)',
        ['--page-muted-soft' as string]:
          'color-mix(in srgb, var(--muted-foreground) 75%, transparent)',
        ['--page-muted-faint' as string]:
          'color-mix(in srgb, var(--muted-foreground) 50%, transparent)',
        ['--page-hover' as string]: 'color-mix(in srgb, var(--foreground) 4%, transparent)',
      }}
    >
      <header
        className="w-full px-6 h-14 flex items-center sticky top-0 z-40 bg-[var(--page-header)] border-b border-[var(--page-line)]"
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <BrandLogo />
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span
              className="text-[13px] text-muted-foreground"
              style={{ fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Inspirations
            </span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 relative">
        <style jsx global>{`
          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
          }
          @keyframes orb-float {
            0% {
              transform: translate(0, 0) scale(1);
              opacity: 0.15;
            }
            33% {
              transform: translate(4%, -10%) scale(1.1);
              opacity: 0.25;
            }
            66% {
              transform: translate(-2%, 5%) scale(0.95);
              opacity: 0.15;
            }
            100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.15;
            }
          }
          @keyframes orb-float-reverse {
            0% {
              transform: translate(0, 0) scale(1);
              opacity: 0.15;
            }
            33% {
              transform: translate(-4%, 10%) scale(0.95);
              opacity: 0.15;
            }
            66% {
              transform: translate(2%, -5%) scale(1.1);
              opacity: 0.25;
            }
            100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.15;
            }
          }
        `}</style>

        <div className="absolute top-0 left-0 right-0 h-[600px] overflow-hidden pointer-events-none -z-10">
          <div
            className="absolute top-[-150px] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/20 dark:bg-violet-600/30 blur-[120px]"
            style={{ animation: 'orb-float 20s ease-in-out infinite' }}
          />
          <div
            className="absolute top-[-100px] right-[10%] w-[400px] h-[400px] rounded-full bg-fuchsia-600/15 dark:bg-fuchsia-600/20 blur-[120px]"
            style={{ animation: 'orb-float-reverse 25s ease-in-out infinite' }}
          />
          <div
            className="absolute top-[50px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-500/10 dark:bg-blue-500/15 blur-[150px]"
            style={{ animation: 'orb-float 30s ease-in-out infinite' }}
          />
        </div>

        <div className="pt-12 pb-8 animate-fade-in-up" style={{ animationDelay: '0s' }}>
          <h1
            className="text-[28px] sm:text-[36px] bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/45"
            style={{ fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.15 }}
          >
            Explore what&apos;s working
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-2.5">
            <p
              className="text-[14px] sm:text-[15px] text-muted-foreground"
              style={{ letterSpacing: '-0.01em', fontWeight: 400 }}
            >
              {pagination ? pagination.total.toLocaleString() : '...'} startups with verified
              revenue
            </p>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <a
              href="https://trustmrr.com"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontWeight: 450 }}
            >
              Powered by TrustMRR
              <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 pb-8 mb-8"
          style={{ borderBottom: '1px solid var(--page-line)' }}
        >
          <button
            onClick={() => updateParams({ category: undefined, page: undefined })}
            className={`group relative overflow-hidden flex flex-col items-start justify-between p-5 sm:p-6 rounded-[24px] transition-all duration-300 animate-fade-in-up cursor-pointer hover:bg-[var(--page-hover)] ${BENTO_CLASSES[0]}`}
            style={{
              minHeight: '130px',
              background: !activeCategory ? 'var(--page-panel-strong)' : 'var(--page-panel)',
              border: !activeCategory
                ? '1px solid var(--page-line)'
                : '1px solid var(--page-line-soft)',
              boxShadow: !activeCategory ? 'var(--shadow-surface-sm)' : 'none',
              animationDelay: '0.1s',
              animationFillMode: 'both',
            }}
          >
            <div className="relative z-10 flex flex-col items-start gap-1">
              <span
                className="text-[17px] sm:text-[19px] tracking-tight"
                style={{ fontWeight: 650, color: 'var(--foreground)' }}
              >
                All Categories
              </span>
              <span
                className="text-[13px]"
                style={{
                  color: !activeCategory ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontWeight: 500,
                  opacity: !activeCategory ? 0.72 : 1,
                }}
              >
                {pagination ? `${pagination.total.toLocaleString()} startups` : '...'}
              </span>
            </div>

            <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
              <AllIcon
                className="w-24 h-24 sm:w-32 sm:h-32"
                style={{ color: 'var(--foreground)', opacity: !activeCategory ? 0.28 : 0.12 }}
              />
            </div>
          </button>

          {categories?.slice(0, 12).map((cat, i) => {
            const index = i + 1
            const Icon = (cat.category && CAT_ICONS[cat.category]) || Layers
            const colors = getCatColor(cat.category)
            const isActive = activeCategory === cat.category

            return (
              <button
                key={cat.category}
                onClick={() =>
                  updateParams({
                    category: isActive ? undefined : cat.category!,
                    page: undefined,
                  })
                }
                className={`group relative overflow-hidden flex flex-col items-start justify-between p-5 sm:p-6 rounded-[24px] transition-all duration-300 animate-fade-in-up cursor-pointer hover:bg-[var(--page-hover)] ${BENTO_CLASSES[index] || 'col-span-1'}`}
                style={{
                  minHeight: '130px',
                  background: isActive
                    ? `color-mix(in srgb, ${colors.icon} 10%, var(--card))`
                    : 'var(--page-panel)',
                  border: isActive
                    ? `1px solid color-mix(in srgb, ${colors.icon} 40%, var(--border))`
                    : '1px solid var(--page-line-soft)',
                  boxShadow: isActive ? 'var(--shadow-surface-sm)' : 'none',
                  animationDelay: `${0.15 + index * 0.04}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="relative z-10 flex flex-col items-start gap-1">
                  <span
                    className="text-[17px] sm:text-[19px] tracking-tight"
                    style={{ fontWeight: 650, color: 'var(--foreground)' }}
                  >
                    {cat.category}
                  </span>
                  <span
                    className="text-[13px]"
                    style={{
                      color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                      fontWeight: 500,
                      opacity: isActive ? 0.72 : 1,
                    }}
                  >
                    {cat.count.toLocaleString()} startups
                  </span>
                </div>

                <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                  <Icon
                    className="w-24 h-24 sm:w-32 sm:h-32"
                    style={{ color: colors.icon, opacity: isActive ? 0.28 : 0.14 }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {REVENUE_FILTERS.map((filter) => {
              const isActive = activeRevFilter.value === filter.value
              return (
                <button
                  key={filter.value}
                  onClick={() => updateParams({ rev: filter.value, page: undefined })}
                  className="rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors"
                  style={{
                    background: isActive ? 'var(--foreground)' : 'var(--page-panel)',
                    color: isActive ? 'var(--background)' : 'var(--foreground)',
                    border: isActive
                      ? '1px solid var(--foreground)'
                      : '1px solid var(--page-line-soft)',
                    fontWeight: 500,
                  }}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {pagination ? `${pagination.total.toLocaleString()} results` : 'Loading...'}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 pb-14">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--page-line-soft)] bg-[var(--page-panel)] p-3.5 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-muted/40" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 w-48 rounded bg-muted/40" />
                    <div className="h-3 w-72 rounded bg-muted/30" />
                  </div>
                  <div className="hidden sm:block h-8 w-16 rounded bg-muted/30" />
                  <div className="hidden md:block h-8 w-20 rounded bg-muted/30" />
                  <div className="h-8 w-16 rounded bg-muted/30" />
                </div>
              </div>
            ))}
          </div>
        ) : startups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--page-line)] p-16 text-center">
            <p className="text-sm text-muted-foreground">No startups found for this filter.</p>
          </div>
        ) : (
          <div className="pb-14">
            <div className="space-y-2">
              {startups.map((startup, i) => (
                <StartupCard key={startup.slug} startup={startup} index={i} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() =>
                    updateParams({
                      page: params.page && params.page > 1 ? String(params.page - 1) : undefined,
                    })
                  }
                  disabled={!params.page || params.page <= 1}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm disabled:opacity-40"
                  style={{
                    borderColor: 'var(--page-line)',
                    background: 'var(--page-panel)',
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <span className="px-3 text-sm text-muted-foreground">
                  Page {params.page || 1} of {pagination.totalPages}
                </span>

                <button
                  onClick={() =>
                    updateParams({
                      page:
                        params.page && params.page < pagination.totalPages
                          ? String(params.page + 1)
                          : undefined,
                    })
                  }
                  disabled={!params.page || params.page >= pagination.totalPages}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm disabled:opacity-40"
                  style={{
                    borderColor: 'var(--page-line)',
                    background: 'var(--page-panel)',
                  }}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
