'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'react-hot-toast'
import { authClient } from '@/lib/auth-client'
import { isWaitlistMode } from '@/lib/waitlist'
import { WaitlistScreen } from '@/components/waitlist-screen'
import { useRouter } from 'next/navigation'
import {
  ArrowUp,
  Briefcase,
  CalendarCheck,
  Layers,
  LayoutDashboard,
  Palette,
  ShoppingBag,
  Store,
  UserCircle,
} from 'lucide-react'

/* ─── Typing placeholder ─── */
function useTypingPlaceholder(items: string[], speed = 45, pause = 2200) {
  const [text, setText] = useState('')
  const [idx, setIdx] = useState(0)
  const [typing, setTyping] = useState(true)

  useEffect(() => {
    const current = items[idx]!
    if (typing) {
      if (text.length < current.length) {
        const t = setTimeout(() => setText(current.slice(0, text.length + 1)), speed)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setTyping(false), pause)
      return () => clearTimeout(t)
    }
    if (text.length > 0) {
      const t = setTimeout(() => setText(text.slice(0, -1)), speed / 2)
      return () => clearTimeout(t)
    }
    setIdx((p) => (p + 1) % items.length)
    setTyping(true)
  }, [text, idx, typing, items, speed, pause])

  return text
}

const placeholders = [
  'A brutalist portfolio with bold type and raw edges...',
  'A SaaS dashboard with live charts and dark UI...',
  'A storefront with floating cart and smooth hover cards...',
  'A booking app with calendar slots and instant confirm...',
]

const suggestions = [
  {
    icon: UserCircle,
    label: 'Portfolio',
    color: 'text-violet-600',
    prompt:
      'A brutalist developer portfolio — bold oversized typography, monospace headings, exposed grid lines, high-contrast black and white with one accent color, project cards with raw bordered edges, and a noise-textured background',
  },
  {
    icon: LayoutDashboard,
    label: 'SaaS Dashboard',
    color: 'text-blue-600',
    prompt:
      'A glassmorphism SaaS dashboard — frosted translucent cards over a gradient mesh background, real-time metric counters with number animations, sparkline charts in each card, and a floating command palette',
  },
  {
    icon: ShoppingBag,
    label: 'Online Store',
    color: 'text-amber-600',
    prompt:
      'A clean minimal e-commerce store — airy whitespace layout, product cards with soft shadows that lift on hover, a slide-out cart drawer, sticky category nav bar, and Stripe-powered checkout flow',
  },
  {
    icon: CalendarCheck,
    label: 'Booking App',
    color: 'text-emerald-600',
    prompt:
      'A neo-minimal booking platform — rounded soft UI cards, pastel accent tones, interactive weekly calendar with color-coded time slots, instant booking confirmation toasts, and a clean appointment history list',
  },
  {
    icon: Briefcase,
    label: 'Client Portal',
    color: 'text-rose-600',
    prompt:
      'A Swiss-style client portal — tight grid system, neutral tones with red accents, Helvetica-inspired type hierarchy, kanban milestone board, invoice table with status pills, and a per-project file vault',
  },
  {
    icon: Palette,
    label: 'Agency Site',
    color: 'text-cyan-600',
    prompt:
      'An editorial agency landing page — asymmetric layout, large hero imagery with overlapping text, horizontal scroll case study gallery, monochrome palette with one vivid highlight color, and smooth page transitions',
  },
]

/* ─── Prompt input ─── */
function LandingPrompt({
  value,
  onChange,
  onSend,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const hasValue = value.trim().length > 0

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 160)}px`
  }, [value])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      onClick={() => ref.current?.focus()}
      className={`
        cursor-text rounded-2xl border bg-card
        transition-all duration-200
        ${
          focused
            ? 'border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
            : 'border-border/50 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-border'
        }
      `}
    >
      <div className="px-5 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-3.5">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none bg-transparent text-foreground text-[15px] sm:text-base leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
        />

        <div className="flex items-center justify-end pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSend()
            }}
            disabled={!hasValue}
            className={`
              flex items-center justify-center
              h-8 w-8 rounded-lg transition-all duration-150
              ${
                hasValue
                  ? 'bg-foreground text-background cursor-pointer hover:opacity-85 active:scale-95'
                  : 'bg-foreground/[0.06] text-muted-foreground/25 cursor-not-allowed'
              }
            `}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ─── */
function IndexContent() {
  const waitlistMode = isWaitlistMode()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [promptValue, setPromptValue] = useState('')
  const router = useRouter()
  const placeholder = useTypingPlaceholder(placeholders)

  useEffect(() => {
    const load = async () => {
      const { data } = await authClient.getSession()
      setIsLoggedIn(!!data?.user)
    }
    load()
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    const initial = url.searchParams.get('initial')
    const error = url.searchParams.get('error')

    if (initial || error) {
      url.searchParams.delete('initial')
      url.searchParams.delete('error')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      if (initial) setPromptValue(initial)
      if (error) toast.error(error)
      sessionStorage.removeItem('pendingPrompt')
      return
    }

    if (!isLoggedIn) return
    const pending = sessionStorage.getItem('pendingPrompt')
    if (!pending) return

    try {
      const { text } = JSON.parse(pending)
      sessionStorage.removeItem('pendingPrompt')
      if (text) setPromptValue(text)
    } catch {
      sessionStorage.removeItem('pendingPrompt')
    }
  }, [isLoggedIn])

  if (waitlistMode) return <WaitlistScreen />

  const handleSend = useCallback(() => {
    const prompt = promptValue.trim()
    if (!prompt) return

    if (isLoggedIn) {
      router.push(`/project/new?${new URLSearchParams({ prompt, type: 'simple' })}`)
    } else {
      sessionStorage.setItem(
        'pendingPrompt',
        JSON.stringify({ text: prompt, projectType: 'simple' }),
      )
      router.push(`/signup?next=${encodeURIComponent(`/?initial=${encodeURIComponent(prompt)}`)}`)
    }
  }, [promptValue, isLoggedIn, router])

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background text-foreground">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 landing-grid" />
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-brand/[0.03] blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-8 h-16 shrink-0 landing-stagger-1">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/surgent-logo.png"
            alt="Surgent"
            width={119}
            height={32}
            className="h-6 w-auto sm:h-7"
            priority
          />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-5 text-[13px]">
          <Link
            href="/marketplace"
            className="hidden sm:flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <Store className="h-3.5 w-3.5" />
            Marketplace
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-foreground text-background px-3.5 py-1.5 rounded-lg text-[13px] font-medium hover:opacity-85 transition-opacity"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Center */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-6 pb-20">
        <div className="w-full max-w-[620px]">
          {/* Headline */}
          <div className="text-center mb-9 sm:mb-11 landing-stagger-2">
            <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] leading-[1.15] tracking-[-0.025em] font-semibold mb-3">
              What will you{' '}
              <span className="font-[var(--font-display)] italic font-normal text-brand">
                build?
              </span>
            </h1>
            <p className="text-muted-foreground/60 text-sm sm:text-[15px]">
              Describe your idea and we&apos;ll turn it into a full-stack app.
            </p>
          </div>

          {/* Prompt */}
          <div className="landing-stagger-3 mb-6">
            <LandingPrompt
              value={promptValue}
              onChange={setPromptValue}
              onSend={handleSend}
              placeholder={placeholder || 'Describe your app...'}
            />
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 landing-stagger-4">
            {suggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => setPromptValue(s.prompt)}
                className="group flex items-center gap-1.5 text-[12px] text-muted-foreground/70 rounded-full bg-card border border-border/40 px-3 py-1.5 transition-all duration-150 hover:text-foreground hover:bg-muted hover:border-border/70 cursor-pointer"
              >
                <s.icon className={`h-3 w-3 shrink-0 ${s.color}`} />
                {s.label}
              </button>
            ))}
          </div>

          {/* Trust */}
          <p className="text-center text-[11px] text-muted-foreground/30 mt-10 tracking-wide landing-stagger-5">
            No credit card required · Free to start
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center gap-6 px-6 h-10 shrink-0 text-[11px] text-muted-foreground/35">
        <Link href="/terms" className="hover:text-muted-foreground/60 transition-colors">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-muted-foreground/60 transition-colors">
          Privacy
        </Link>
        <a
          href="https://twitter.com/benroff_"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-muted-foreground/60 transition-colors"
        >
          Twitter
        </a>
      </footer>
    </div>
  )
}

export default function Index() {
  return (
    <Suspense>
      <IndexContent />
    </Suspense>
  )
}
