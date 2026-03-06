'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Geist, Geist_Mono } from 'next/font/google'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  ArrowUpRight,
  Brain,
  Code2,
  ShoppingCart,
  Megaphone,
  PenTool,
  GraduationCap,
  Smartphone,
  Heart,
  BarChart3,
  Palette,
  Landmark,
  Layers,
  Share2,
  Briefcase,
  Building2,
  Gamepad2,
  Headphones,
  Store,
  MessageCircle,
  DollarSign,
  Wrench,
  Plane,
  Newspaper,
  Coins,
  Cpu,
  Scale,
  Leaf,
  Lock,
  Zap,
  LayoutGrid,
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

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

function fmt(dollars: number): string {
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}k`
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function domain(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
}

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

const CAT_COLORS: Record<string, { bg: string; icon: string; activeBg: string }> = {
  'Artificial Intelligence': {
    bg: 'rgba(139,92,246,0.08)',
    icon: '#a78bfa',
    activeBg: 'rgba(139,92,246,0.15)',
  },
  SaaS: { bg: 'rgba(59,130,246,0.08)', icon: '#60a5fa', activeBg: 'rgba(59,130,246,0.15)' },
  'Developer Tools': {
    bg: 'rgba(16,185,129,0.08)',
    icon: '#34d399',
    activeBg: 'rgba(16,185,129,0.15)',
  },
  Productivity: { bg: 'rgba(6,182,212,0.08)', icon: '#22d3ee', activeBg: 'rgba(6,182,212,0.15)' },
  Marketing: { bg: 'rgba(236,72,153,0.08)', icon: '#f472b6', activeBg: 'rgba(236,72,153,0.15)' },
  'Content Creation': {
    bg: 'rgba(249,115,22,0.08)',
    icon: '#fb923c',
    activeBg: 'rgba(249,115,22,0.15)',
  },
  Education: { bg: 'rgba(99,102,241,0.08)', icon: '#818cf8', activeBg: 'rgba(99,102,241,0.15)' },
  'Mobile Apps': {
    bg: 'rgba(14,165,233,0.08)',
    icon: '#38bdf8',
    activeBg: 'rgba(14,165,233,0.15)',
  },
  'Health & Fitness': {
    bg: 'rgba(244,63,94,0.08)',
    icon: '#fb7185',
    activeBg: 'rgba(244,63,94,0.15)',
  },
  Fintech: { bg: 'rgba(20,184,166,0.08)', icon: '#2dd4bf', activeBg: 'rgba(20,184,166,0.15)' },
  Analytics: { bg: 'rgba(168,85,247,0.08)', icon: '#c084fc', activeBg: 'rgba(168,85,247,0.15)' },
  'Design Tools': {
    bg: 'rgba(217,70,239,0.08)',
    icon: '#e879f9',
    activeBg: 'rgba(217,70,239,0.15)',
  },
  'E-commerce': { bg: 'rgba(245,158,11,0.08)', icon: '#fbbf24', activeBg: 'rgba(245,158,11,0.15)' },
}

const DEFAULT_CAT_COLOR = {
  bg: 'rgba(255,255,255,0.04)',
  icon: '#888',
  activeBg: 'rgba(255,255,255,0.08)',
}

function getCatColor(cat: string | null) {
  if (!cat) return DEFAULT_CAT_COLOR
  return CAT_COLORS[cat] || DEFAULT_CAT_COLOR
}

const REVENUE_FILTERS = [
  { label: '$1k – $30k', value: '1k-30k', min: 1_000, max: 30_000 },
  { label: 'Top Companies', value: 'top', min: undefined, max: undefined },
]

const BENTO_CLASSES = [
  'col-span-1 sm:col-span-1 lg:col-span-1', // 0 All
  'col-span-1 sm:col-span-2 lg:col-span-2', // 1 AI
  'col-span-1 sm:col-span-1 lg:col-span-1', // 2 SaaS
  'col-span-1 sm:col-span-1 lg:col-span-1', // 3 Dev Tools
  'col-span-1 sm:col-span-1 lg:col-span-1', // 4 Productivity
  'col-span-1 sm:col-span-2 lg:col-span-2', // 5 Marketing
  'col-span-1 sm:col-span-1 lg:col-span-1', // 6 Content
  'col-span-1 sm:col-span-1 lg:col-span-1', // 7 Education
  'col-span-1 sm:col-span-1 lg:col-span-1', // 8 Mobile Apps
  'col-span-1 sm:col-span-1 lg:col-span-1', // 9 Health
  'col-span-1 sm:col-span-2 lg:col-span-2', // 10 Fintech
  'col-span-1 sm:col-span-1 lg:col-span-1', // 11 Analytics
  'col-span-1 sm:col-span-3 lg:col-span-1', // 12 Design Tools
]

function StartupCard({ startup, index }: { startup: Startup; index: number }) {
  const hasGrowth = startup.growth30d != null && startup.growth30d > 0
  const CatIcon = (startup.category && CAT_ICONS[startup.category]) || Layers

  return (
    <Link
      href={`/inspirations/${startup.slug}`}
      className="group relative flex flex-col justify-between rounded-xl p-4 surface-card cursor-pointer transition-all duration-300 animate-fade-in-up hover:-translate-y-[2px]"
      style={{
        animationFillMode: 'both',
        animationDelay: `${index * 0.05}s`,
      }}
    >
      <div>
        <div className="flex items-start gap-3 mb-2.5">
          <img
            src={startup.icon!}
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
            style={{ boxShadow: 'var(--shadow-surface-xs)' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h3
                className="text-[14px] text-[#fdf8f0] truncate"
                style={{ fontWeight: 550, letterSpacing: '-0.01em' }}
              >
                {startup.name}
              </h3>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-[#444] group-hover:text-[#888] transition-colors duration-150" />
            </div>
            {startup.website && (
              <p
                className="text-[11.5px] text-[#666] truncate"
                style={{ letterSpacing: '-0.005em' }}
              >
                {domain(startup.website)}
              </p>
            )}
          </div>
        </div>

        {startup.description && (
          <p
            className="text-[12.5px] text-[#777] leading-[1.55] line-clamp-2 mb-2.5"
            style={{ letterSpacing: '-0.005em' }}
          >
            {startup.description}
          </p>
        )}

        {startup.category && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-[#888] bg-[rgba(255,255,255,0.04)] px-2 py-[3px] rounded-md"
            style={{ fontWeight: 480 }}
          >
            <CatIcon className="h-3 w-3 text-[#666]" />
            {startup.category}
          </span>
        )}
      </div>

      <div
        className="flex items-end justify-between mt-3 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div>
          <p
            className="text-[17px] text-[#fdf8f0] leading-none"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            {fmt(startup.revenueLast30Days)}
          </p>
          <p className="text-[10px] text-[#555] mt-1" style={{ fontWeight: 450 }}>
            /month
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasGrowth && (
            <span
              className="flex items-center gap-0.5 text-[11.5px] text-[#22a06b]"
              style={{ fontWeight: 550 }}
            >
              <TrendingUp className="h-3 w-3" />
              {startup.growth30d!.toFixed(0)}%
            </span>
          )}
          {startup.customers > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-[#555]">
              <Users className="h-3 w-3" />
              {startup.customers.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {startup.onSale && startup.askingPrice != null && (
        <div
          className="absolute top-3 right-3 text-[9.5px] text-[#22a06b] px-1.5 py-[2px] rounded-md"
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontWeight: 600,
            background: 'rgba(34,160,107,0.06)',
          }}
        >
          {fmt(startup.askingPrice)}
        </div>
      )}
    </Link>
  )
}

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

export default function InspirationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setUser(data.user as User)
    })
  }, [])

  const revenueFilter = searchParams.get('rev') || '1k-30k'
  const activeRevFilter =
    REVENUE_FILTERS.find((f) => f.value === revenueFilter) || REVENUE_FILTERS[0]

  const params: StartupsQueryParams = {
    page: Number(searchParams.get('page')) || 1,
    perPage: 100,
    sort: 'revenue-desc',
    category: searchParams.get('category') || undefined,
    minRevenue: activeRevFilter?.min,
    maxRevenue: activeRevFilter?.max,
  }

  const { data, isLoading } = useStartupsQuery(params)
  const { data: categories } = useStartupCategoriesQuery()

  function updateParams(updates: Record<string, string | undefined>) {
    const qp = new URLSearchParams()
    const current = {
      category: searchParams.get('category') || undefined,
      rev: searchParams.get('rev') || undefined,
      page: searchParams.get('page') || undefined,
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
  const activeCategory = searchParams.get('category') || null
  const pageOffset = ((params.page ?? 1) - 1) * (params.perPage ?? 100)

  return (
    <div
      className={`min-h-screen ${geist.variable} ${geistMono.variable}`}
      style={{
        fontFamily: 'var(--font-geist), system-ui, sans-serif',
        background: 'hsl(0 0% 11%)',
      }}
    >
      {/* Header */}
      <header
        className="w-full px-6 h-14 flex items-center sticky top-0 z-40"
        style={{
          background: 'rgba(28,28,28,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Image
                src="/surgent-logo-dark.svg"
                alt="Surgent"
                width={119}
                height={32}
                className="h-7 w-auto"
                priority
              />
            </Link>
            <span className="text-[#444]">/</span>
            <span
              className="text-[13px] text-[#888]"
              style={{ fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Inspirations
            </span>
          </div>
          {user ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-[12px] text-[#666] hover:text-[#bbb] transition-colors"
                style={{ fontWeight: 480 }}
              >
                Dashboard
              </button>
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.image} />
                <AvatarFallback
                  className="text-[9px] text-[#999]"
                  style={{ background: 'hsl(60 3% 15%)' }}
                >
                  {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="text-[12px] text-[#666] hover:text-[#bbb] transition-colors"
              style={{ fontWeight: 480 }}
            >
              Sign in
            </button>
          )}
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

        {/* Ambient Background Glow */}
        <div className="absolute top-0 left-0 right-0 h-[600px] overflow-hidden pointer-events-none -z-10">
          <div
            className="absolute top-[-150px] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/30 blur-[120px] mix-blend-screen"
            style={{ animation: 'orb-float 20s ease-in-out infinite' }}
          />
          <div
            className="absolute top-[-100px] right-[10%] w-[400px] h-[400px] rounded-full bg-fuchsia-600/20 blur-[120px] mix-blend-screen"
            style={{ animation: 'orb-float-reverse 25s ease-in-out infinite' }}
          />
          <div
            className="absolute top-[50px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-blue-500/15 blur-[150px] mix-blend-screen"
            style={{ animation: 'orb-float 30s ease-in-out infinite' }}
          />
        </div>

        {/* Hero */}
        <div className="pt-12 pb-8 animate-fade-in-up" style={{ animationDelay: '0s' }}>
          <h1
            className="text-[28px] sm:text-[36px] bg-clip-text text-transparent bg-gradient-to-br from-white via-white/90 to-white/40"
            style={{ fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.15 }}
          >
            Explore what&apos;s working
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-2.5">
            <p
              className="text-[14px] sm:text-[15px] text-[#888]"
              style={{ letterSpacing: '-0.01em', fontWeight: 400 }}
            >
              {pagination ? pagination.total.toLocaleString() : '...'} startups with verified
              revenue
            </p>
            <span className="text-[#444] hidden sm:inline">·</span>
            <a
              href="https://trustmrr.com"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 text-[13px] text-[#666] hover:text-[#bbb] transition-colors"
              style={{ fontWeight: 450 }}
            >
              Powered by TrustMRR
              <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>

        {/* Revenue toggle */}
        <div
          className="inline-flex items-center gap-0.5 p-0.5 rounded-lg mb-6 animate-fade-in-up"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 2px rgba(0,0,0,0.15)',
            animationDelay: '0.05s',
            animationFillMode: 'both',
          }}
        >
          {REVENUE_FILTERS.map((f) => {
            const isActive =
              revenueFilter === f.value || (f.value === '1k-30k' && !searchParams.get('rev'))
            return (
              <button
                key={f.value}
                onClick={() =>
                  updateParams({
                    rev: f.value === '1k-30k' ? undefined : f.value,
                    page: undefined,
                  })
                }
                className="text-[12px] px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150"
                style={{
                  fontWeight: 520,
                  letterSpacing: '-0.01em',
                  ...(isActive
                    ? {
                        background: 'hsl(60 3% 18%)',
                        color: '#fdf8f0',
                        boxShadow: 'var(--shadow-surface-xs)',
                      }
                    : {
                        background: 'transparent',
                        color: '#666',
                      }),
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Categories Bento Grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 pb-12 mb-12"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* All tile */}
          <button
            onClick={() => updateParams({ category: undefined, page: undefined })}
            className={`group relative overflow-hidden flex flex-col items-start justify-between p-5 sm:p-6 rounded-[24px] transition-all duration-300 animate-fade-in-up cursor-pointer hover:-translate-y-1 ${BENTO_CLASSES[0]}`}
            style={{
              minHeight: '130px',
              background: !activeCategory ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
              border: !activeCategory
                ? '1px solid rgba(255,255,255,0.15)'
                : '1px solid rgba(255,255,255,0.05)',
              boxShadow: !activeCategory
                ? '0 0 0 1px rgba(255,255,255,0.05), 0 8px 24px -8px rgba(0,0,0,0.5)'
                : 'none',
              animationDelay: '0.1s',
              animationFillMode: 'both',
            }}
          >
            <div className="relative z-10 flex flex-col items-start gap-1">
              <span
                className="text-[17px] sm:text-[19px] tracking-tight"
                style={{ fontWeight: 650, color: !activeCategory ? '#fff' : '#eee' }}
              >
                All Categories
              </span>
              <span
                className="text-[13px]"
                style={{ color: !activeCategory ? '#ccc' : '#888', fontWeight: 500 }}
              >
                {pagination ? `${pagination.total.toLocaleString()} startups` : '...'}
              </span>
            </div>

            <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
              <AllIcon
                className="w-24 h-24 sm:w-32 sm:h-32"
                style={{ color: '#fff', opacity: !activeCategory ? 0.2 : 0.05 }}
              />
            </div>
          </button>

          {/* Category tiles */}
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
                className={`group relative overflow-hidden flex flex-col items-start justify-between p-5 sm:p-6 rounded-[24px] transition-all duration-300 animate-fade-in-up cursor-pointer hover:-translate-y-1 ${BENTO_CLASSES[index] || 'col-span-1'}`}
                style={{
                  minHeight: '130px',
                  background: isActive ? colors.activeBg : colors.bg,
                  border: isActive ? `1px solid ${colors.icon}40` : `1px solid ${colors.icon}15`,
                  boxShadow: isActive
                    ? `0 0 0 1px ${colors.icon}20, 0 8px 24px -8px ${colors.icon}40`
                    : 'none',
                  animationDelay: `${0.1 + index * 0.05}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="relative z-10 flex flex-col items-start gap-1 text-left">
                  <span
                    className="text-[17px] sm:text-[19px] tracking-tight line-clamp-1"
                    style={{ fontWeight: 650, color: isActive ? '#fff' : '#eee' }}
                  >
                    {cat.category}
                  </span>
                  <span
                    className="text-[13px]"
                    style={{ color: isActive ? `${colors.icon}dd` : '#888', fontWeight: 500 }}
                  >
                    {cat.count.toLocaleString()} startups
                  </span>
                </div>

                <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                  <Icon
                    className="w-24 h-24 sm:w-32 sm:h-32"
                    style={{
                      color: colors.icon,
                      opacity: isActive ? 0.35 : 0.1,
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[...Array(18)].map((_, i) => (
              <div
                key={i}
                className="animate-fade-in-up"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="h-[210px] rounded-xl animate-pulse surface-card" />
              </div>
            ))}
          </div>
        ) : startups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28">
            <p className="text-[14px] text-[#ddd]" style={{ fontWeight: 550 }}>
              No startups found
            </p>
            <p className="text-[13px] text-[#555] mt-1">Try a different category or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {startups.map((s, i) => (
              <StartupCard key={s.slug} startup={s} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div
            className="flex items-center justify-between py-6 mt-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p
              className="text-[11px] text-[#555]"
              style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 450 }}
            >
              {pageOffset + 1}–{Math.min(pageOffset + (params.perPage ?? 100), pagination.total)} of{' '}
              {pagination.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => updateParams({ page: String(pagination.page - 1) })}
                disabled={pagination.page <= 1}
                className="h-7 w-7 flex items-center justify-center rounded-md text-[#666] hover:text-[#bbb] disabled:opacity-25 disabled:pointer-events-none transition-colors"
                style={{
                  ...(pagination.page > 1
                    ? {
                        background: 'hsl(60 3% 15%)',
                        boxShadow: 'var(--shadow-surface-xs)',
                      }
                    : {}),
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span
                className="text-[11px] text-[#bbb] px-2.5"
                style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 450 }}
              >
                {pagination.page}/{pagination.totalPages}
              </span>
              <button
                onClick={() => updateParams({ page: String(pagination.page + 1) })}
                disabled={pagination.page >= pagination.totalPages}
                className="h-7 w-7 flex items-center justify-center rounded-md text-[#666] hover:text-[#bbb] disabled:opacity-25 disabled:pointer-events-none transition-colors"
                style={{
                  ...(pagination.page < pagination.totalPages
                    ? {
                        background: 'hsl(60 3% 15%)',
                        boxShadow: 'var(--shadow-surface-xs)',
                      }
                    : {}),
                }}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
