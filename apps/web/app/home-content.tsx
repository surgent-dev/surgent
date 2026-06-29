'use client'

import { ArrowRight, ArrowUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SurgentLogo } from '@/components/surgent-logo'
import { authClient } from '@/lib/auth-client'

/* ─── Word flip rotation ─── */

const WORDS = ['websites', 'sales agents', 'lead funnels', 'landing pages', 'web applications']

function useFlipWord() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2000)
    return () => clearInterval(t)
  }, [])
  return { word: WORDS[index] ?? '', index }
}

/* ─── Data ─── */

const AVATARS = [
  { src: '/lovedby/alidar.png', alt: 'Alidar' },
  { src: '/lovedby/asadbek.jpeg', alt: 'Asadbek' },
  { src: '/lovedby/diyor.jpeg', alt: 'Diyor' },
  { src: '/lovedby/sardor.jpeg', alt: 'Sardor' },
]

/* ─── Custom feature icons ─── */

function IcAiBuilder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <path d="M14 3l1.8 4.2L20 9l-4.2 1.8L14 15l-1.8-4.2L8 9l4.2-1.8z" fill="#7c5cfc" />
      <path
        d="M21 14l1 2.5L24.5 17.5l-2.5 1L22 21l-1-2.5L18.5 17.5l2.5-1z"
        fill="#b48efe"
        opacity="0.7"
      />
      <path
        d="M8 18l.7 1.6L10.3 20.3l-1.6.7L8 22.6l-.7-1.6L5.7 20.3l1.6-.7z"
        fill="#b48efe"
        opacity="0.4"
      />
    </svg>
  )
}

function IcCodeOwn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <path
        d="M10 7L4 14l6 7"
        stroke="#059669"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 7l6 7-6 7"
        stroke="#059669"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 4l-4 20" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IcPayments({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <rect x="3" y="7" width="22" height="14" rx="3" stroke="#3b82f6" strokeWidth="2" />
      <path d="M3 12h22" stroke="#3b82f6" strokeWidth="2" />
      <circle cx="19" cy="18" r="2" fill="#60a5fa" opacity="0.5" />
      <circle cx="22" cy="18" r="2" fill="#3b82f6" opacity="0.3" />
    </svg>
  )
}

function IcAnalytics({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <rect x="4" y="18" width="4" height="6" rx="1" fill="#ec4899" opacity="0.4" />
      <rect x="12" y="12" width="4" height="12" rx="1" fill="#ec4899" opacity="0.6" />
      <rect x="20" y="6" width="4" height="18" rx="1" fill="#ec4899" />
      <path d="M4 25h20" stroke="#f472b6" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}

function IcSeo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" stroke="#2563eb" strokeWidth="2" />
      <path d="M18 18l6 6" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 12h6M12 9v6" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IcGeo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <circle cx="14" cy="14" r="10" stroke="#0891b2" strokeWidth="2" />
      <ellipse cx="14" cy="14" rx="4" ry="10" stroke="#0891b2" strokeWidth="1.5" />
      <path d="M4 14h20" stroke="#22d3ee" strokeWidth="1.5" />
      <path d="M6 9h16M6 19h16" stroke="#22d3ee" strokeWidth="1" opacity="0.4" />
    </svg>
  )
}

function IcDeploy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <circle cx="14" cy="14" r="10" stroke="#f59e0b" strokeWidth="2" />
      <path
        d="M14 8v6l4 2"
        stroke="#fb923c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="1.5" fill="#f59e0b" />
    </svg>
  )
}

function IcMarketplace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <path d="M4 10l2-6h16l2 6" stroke="#9333ea" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 10v13h20V10" stroke="#9333ea" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="16" width="8" height="7" rx="1" stroke="#c084fc" strokeWidth="1.8" />
    </svg>
  )
}

const STEPS = [
  {
    n: '01',
    icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4a1.svg',
    t: 'Describe your idea',
    d: 'Tell us what your business does. A few sentences is all it takes — our AI understands your industry, audience, and goals.',
  },
  {
    n: '02',
    icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2692.svg',
    t: 'AI builds it',
    d: "Website, sales agent, lead capture, branded content — generated in seconds. Review, tweak in the editor, or let AI iterate until it's right.",
  },
  {
    n: '03',
    icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4b0.svg',
    t: 'Connect payments',
    d: 'Link Stripe or Whop in one click. Subscriptions, one-time payments, invoices. Revenue starts flowing the moment you go live.',
  },
  {
    n: '04',
    icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f680.svg',
    t: 'Deploy & grow',
    d: 'Publish to your custom domain or a free .surgent.site URL. Your AI agent works 24/7 — capturing leads and closing deals while you sleep.',
  },
]

const NAV_LINK =
  'font-display text-[0.9rem] font-medium text-[#1d1c22] dark:text-foreground transition-all px-4 py-2 rounded-full hover:bg-[#1d1c220d]'
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

/* ─── Main ─── */

function IndexContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()
  const { word } = useFlipWord()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    authClient.getSession().then(({ data }) => setIsLoggedIn(!!data?.user))
  }, [])
  useEffect(() => {
    const u = new URL(window.location.href)
    const e = u.searchParams.get('error')
    if (e) {
      u.searchParams.delete('error')
      window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
      toast.error(e)
    }
  }, [])

  const go = (text?: string) => {
    const q = (text ?? prompt).trim()
    router.push(q ? `/get-started?prompt=${encodeURIComponent(q)}` : '/get-started')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f5f5f7] dark:bg-background text-foreground">
      {/* ─── Nav + Hero wrapper ─── */}
      <div className="relative bg-[#f5f5f7] dark:bg-background overflow-clip">
        {/* BG image */}
        <div className="absolute inset-0 pointer-events-none hero-bg-zoom">
          <Image
            src="/bgbig.png"
            alt=""
            fill
            className="object-cover opacity-[0.04] dark:opacity-[0.08] dark:invert select-none"
            priority
          />
        </div>

        {/* ─── Nav ─── */}
        <header className="sticky top-0 z-50 px-4 sm:px-8 pt-4 pb-2 transition-all duration-300">
          <div
            className={`flex items-center justify-between w-full mx-auto transition-all duration-300 ease-out ${scrolled ? 'max-w-3xl border border-[#1d1c220d] dark:border-border/20 bg-[#f5f5f7]/85 dark:bg-card/85 backdrop-blur-2xl rounded-full px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]' : 'max-w-5xl px-3 py-2.5'}`}
          >
            <Link href="/" className="pl-3">
              <SurgentLogo className="text-[1.5rem]" />
            </Link>

            <nav className="hidden sm:flex items-center gap-0">
              <Link href="/inspirations" className={NAV_LINK}>
                Inspirations
              </Link>
              <Link href="/marketplace" className={NAV_LINK}>
                Marketplace
              </Link>
              <div className="flex items-center gap-0 ml-1">
                <a
                  href="https://x.com/surgentdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="text-[#b0b1b3] hover:text-[#1d1c22] dark:hover:text-foreground transition-colors p-2.5 rounded-full hover:bg-[#1d1c220d]"
                >
                  <XIcon />
                </a>
                <a
                  href="https://instagram.com/surgentdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-[#b0b1b3] hover:text-[#1d1c22] dark:hover:text-foreground transition-colors p-2.5 rounded-full hover:bg-[#1d1c220d]"
                >
                  <InstagramIcon />
                </a>
              </div>
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

        {/* ─── Hero ─── */}
        <section className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-10 pt-28 sm:pt-40 pb-20 sm:pb-28 text-center">
          <h1 className="landing-stagger-1 font-display text-[2.75rem] sm:text-[3.75rem] lg:text-[5rem] leading-[1.15] tracking-[-0.04em] font-medium text-[#1d1c22] dark:text-foreground mb-5">
            Describe your <span className="hero-gradient-warm px-[0.05em]">idea</span>, we turn it
            into{' '}
            <span
              key={word}
              className="hero-word-flip hero-shimmer inline-block px-[0.05em] py-[0.1em]"
            >
              {word}
            </span>
          </h1>

          <p className="landing-stagger-2 text-[#475467] dark:text-muted-foreground text-base max-w-[26rem] mx-auto leading-[1.5] mb-8">
            Just describe what you do. We handle the rest.
          </p>

          {/* Prompt box */}
          <div className="landing-stagger-3 w-full mx-auto mb-4 relative">
            <div className="absolute -inset-16 sm:-inset-24 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,252,0.08)_0%,rgba(124,92,252,0.03)_40%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(155,133,253,0.12)_0%,rgba(155,133,253,0.04)_40%,transparent_70%)] pointer-events-none" />
            <div className="relative rounded-[1.25rem] border border-[#1d1c220d] dark:border-border/20 bg-white dark:bg-card shadow-[0_0_0_4px_#ececec] dark:shadow-[0_0_0_4px_rgba(255,255,255,0.05)] p-4 flex flex-col gap-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    go()
                  }
                }}
                placeholder="Describe your business idea..."
                rows={4}
                className="w-full resize-none bg-transparent text-[15px] text-[#1d1c22] dark:text-foreground placeholder:text-[#b0b1b3] px-2 pt-1 pb-0 focus:outline-none leading-relaxed"
              />
              <div className="flex items-center justify-end">
                <button
                  onClick={() => go()}
                  className="size-9 rounded-xl bg-[#1d1c22] dark:bg-foreground text-white dark:text-background flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="landing-stagger-4 mt-6 inline-flex items-center gap-2 text-[12px] text-[#b0b1b3] whitespace-nowrap">
            <div className="flex -space-x-1">
              {AVATARS.map((a) => (
                <Image
                  key={a.alt}
                  src={a.src}
                  alt={a.alt}
                  width={20}
                  height={20}
                  className="size-5 rounded-full border border-white dark:border-background object-cover"
                />
              ))}
            </div>
            <div className="flex items-center gap-px">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-[9px] text-[#f59e0b]"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-[#1d1c22] dark:text-foreground font-medium">3,000+</span> users
            <span className="text-[#d4d4d4]">|</span>
            <span className="text-[#1d1c22] dark:text-foreground font-medium">5,000+</span> sites
            built
          </div>
        </section>
      </div>

      {/* ─── Features ─── */}
      <section className="px-6 sm:px-10 py-24 sm:py-32">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#b0b1b3] mb-3 text-center">
            Everything you need
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-medium tracking-[-0.04em] text-[#1d1c22] dark:text-foreground leading-[1.1] text-center mb-20">
            From idea to revenue. One platform.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-14 sm:gap-y-16">
            <div>
              <IcAiBuilder className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                AI-powered builder
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Describe your idea in plain English. Our AI generates a full website with copy,
                layout, and branding tailored to your business.
              </p>
            </div>
            <div>
              <IcPayments className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                Built-in payments
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Connect Stripe or Whop in one click. Accept subscriptions, one-time payments, and
                invoices from day one.
              </p>
            </div>
            <div>
              <IcSeo className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                SEO built in
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Meta tags, sitemaps, open graph, and structured data generated automatically. Rank
                higher without thinking about it.
              </p>
            </div>
            <div>
              <IcGeo className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                GEO optimized
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Your content is optimized for AI search engines and generative results. Get
                discovered by ChatGPT, Perplexity, and others.
              </p>
            </div>
            <div>
              <IcAnalytics className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                Analytics
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Track visitors, conversions, and revenue in real time. Understand what&apos;s
                working and double down on it.
              </p>
            </div>
            <div>
              <IcDeploy className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                Instant deploy
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Go live on a free .surgent.site domain or your own custom domain. SSL, CDN, and
                global edge hosting included.
              </p>
            </div>
            <div>
              <IcCodeOwn className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                Full code access
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Every project is real code you own. Edit in our studio, export, or connect your own
                domain. No lock-in, ever.
              </p>
            </div>
            <div>
              <IcMarketplace className="h-7 w-7 mb-4" />
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#1d1c22] dark:text-foreground mb-2">
                Marketplace
              </h3>
              <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                Buy proven templates from the community or sell what you build. Turn your projects
                into a revenue stream.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="px-6 sm:px-10 py-24 sm:py-32 border-t border-[#1d1c220d] dark:border-border/10">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#b0b1b3] mb-3 text-center">
            How it works
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-medium tracking-[-0.04em] text-[#1d1c22] dark:text-foreground leading-[1.1] text-center mb-20">
            Four steps to a live business.
          </h2>

          <div className="space-y-20">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-8">
                <div className="shrink-0 w-16 flex flex-col items-end gap-2 pt-6">
                  <Image src={s.icon} alt="" width={28} height={28} className="size-7" />
                  <span className="font-display text-[13px] font-medium text-[#b0b1b3] tabular-nums">
                    {s.n}
                  </span>
                </div>
                <div className="border-t border-[#1d1c220d] dark:border-border/10 pt-6 flex-1">
                  <h3 className="font-display text-lg font-medium text-[#1d1c22] dark:text-foreground mb-2">
                    {s.t}
                  </h3>
                  <p className="text-[14px] text-[#475467] dark:text-muted-foreground leading-relaxed">
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 sm:px-10 py-24 sm:py-32 border-t border-[#1d1c220d] dark:border-border/10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-medium tracking-[-0.04em] text-[#1d1c22] dark:text-foreground leading-[1.1] mb-4">
            Ready to build?
          </h2>
          <p className="text-[15px] text-[#475467] dark:text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            Join thousands of founders who launched their business with a single prompt.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="btn-brand inline-flex items-center justify-center gap-2 h-11 w-full sm:w-auto px-7 rounded-full font-display text-[0.95rem] font-medium cursor-pointer whitespace-nowrap"
            >
              Start building <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
            <Link
              href="/inspirations"
              className="btn-brand-secondary inline-flex items-center justify-center h-11 w-full sm:w-auto px-6 rounded-full font-display text-[0.95rem] font-medium whitespace-nowrap"
            >
              Browse inspirations
            </Link>
          </div>
        </div>
      </section>

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
            <div className="mt-10 border-t border-[#1d1c220d] dark:border-border/15 pt-6 text-[12px] leading-relaxed text-[#475467] dark:text-muted-foreground">
              <p className="max-w-3xl">
                <span className="font-medium text-[#1d1c22] dark:text-foreground">
                  SMS support:
                </span>{' '}
                Text +1 (628) 212-4887 for Surgent customer care. Message frequency varies. Message
                and data rates may apply. Reply HELP for help, STOP to cancel.{' '}
                <Link href="/privacy" className="underline underline-offset-4">
                  Privacy Policy
                </Link>{' '}
                ·{' '}
                <Link href="/terms" className="underline underline-offset-4">
                  Terms
                </Link>
                .
              </p>
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

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

export default function HomeContent() {
  return (
    <Suspense>
      <IndexContent />
    </Suspense>
  )
}
