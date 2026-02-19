'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ArrowUp,
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  Briefcase,
  Globe,
  Palette,
} from 'lucide-react'
import Image from 'next/image'

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
    icon: LayoutDashboard,
    label: 'SaaS Dashboard',
    prompt:
      'A glassmorphism SaaS dashboard with frosted translucent cards, real-time metric counters, sparkline charts, and a floating command palette',
  },
  {
    icon: ShoppingCart,
    label: 'Online Store',
    prompt:
      'A clean minimal e-commerce store with product cards, soft hover shadows, a slide-out cart drawer, and payment-powered checkout',
  },
  {
    icon: Palette,
    label: 'Portfolio',
    prompt:
      'A brutalist developer portfolio with bold oversized typography, monospace headings, high-contrast black and white with one accent color',
  },
  {
    icon: Calendar,
    label: 'Booking App',
    prompt:
      'A neo-minimal booking platform with rounded soft UI cards, interactive weekly calendar with color-coded time slots and instant confirmations',
  },
  {
    icon: Briefcase,
    label: 'Client Portal',
    prompt:
      'A Swiss-style client portal with tight grid system, kanban milestone board, invoice table with status pills, and a per-project file vault',
  },
  {
    icon: Globe,
    label: 'Agency Site',
    prompt:
      'An editorial agency landing page with asymmetric layout, large hero imagery, horizontal scroll case study gallery, and smooth page transitions',
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

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 160)}px`
  }, [value])

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend],
  )

  return (
    <div
      onClick={() => ref.current?.focus()}
      className="cursor-text relative isolate transition-all duration-200"
      style={{
        borderRadius: '0.75rem',
        boxShadow: focused
          ? '0 0 0 2px rgba(124, 58, 237, 0.2), 0 5px 5px -2.5px #00000008, 0 3px 3px -1.5px #00000005, 0 2px 2px -1px #00000005, 0 1px 1px -0.5px #00000008, 0 0.5px 0.5px 0 #0000000a, 0 0 0 1px #0000000f'
          : '0 5px 5px -2.5px #00000008, 0 3px 3px -1.5px #00000005, 0 2px 2px -1px #00000005, 0 1px 1px -0.5px #00000008, 0 0.5px 0.5px 0 #0000000a, 0 0 0 1px #0000000f',
        background: '#fdfdfd',
      }}
    >
      <div className="px-4 pt-3.5 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={2}
          style={{ fontWeight: 450 }}
          className="w-full resize-none bg-transparent text-[#303030] text-[13px] sm:text-sm leading-relaxed placeholder:text-[#8a8a8a] focus:outline-none"
        />

        <div className="flex items-center justify-between pt-1.5">
          <span className="text-[11px] text-[#8a8a8a]">Press Enter to send</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSend()
            }}
            className="flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-100 bg-brand text-white btn-elevated-brand cursor-pointer hover:bg-brand/90 active:scale-95"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Suggestion buttons ─── */
function SuggestionButtons({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 landing-stagger-4">
      {suggestions.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.prompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] sm:text-[13px] text-[#616161] bg-[#f6f6f6] hover:bg-[#eeeeee] hover:text-[#303030] transition-all duration-150 cursor-pointer active:scale-[0.97]"
          style={{ fontWeight: 500 }}
        >
          <s.icon className="h-3.5 w-3.5 shrink-0" />
          {s.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Hero ─── */
export function LandingHero({
  promptValue,
  onPromptChange,
  onSend,
}: {
  promptValue: string
  onPromptChange: (v: string) => void
  onSend: () => void
}) {
  const placeholder = useTypingPlaceholder(placeholders)

  return (
    <section className="relative flex-1 flex flex-col items-center justify-center pt-16 pb-12 sm:pt-20 sm:pb-16 overflow-hidden">
      <div className="relative z-10 w-full max-w-[720px] mx-auto px-5 sm:px-6">
        {/* Headline */}
        <div className="text-center mb-8 sm:mb-10 landing-stagger-2">
          <a
            href="https://whop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#e0e6eb] hover:border-[#ccc] bg-white mb-6 transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <span
              className="text-[13px] text-[#8a8a8a] group-hover:text-[#616161] transition-colors"
              style={{ fontWeight: 450 }}
            >
              Backed by
            </span>
            <Image
              src="/whop-logo.svg"
              alt="Whop"
              width={72}
              height={19}
              className="h-[19px] w-auto"
            />
          </a>
          <h1
            className="font-(--font-satoshi) text-[2.25rem] sm:text-[2.75rem] lg:text-5xl leading-[1.2] tracking-[-0.035em] text-[#1a1a1a] mb-4"
            style={{ fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
          >
            Build apps that{' '}
            <span className="bg-[#f6f6f6] px-2 py-1 rounded-md inline-block leading-[1.1]">
              make money
            </span>
          </h1>
          <p
            className="text-[#717171] text-[13.5px] sm:text-[15px] max-w-136 mx-auto leading-[1.65]"
            style={{ fontWeight: 450 }}
          >
            Describe your idea, get a full app with payments built in — no company or bank account
            needed. Start earning from day one.
          </p>
        </div>

        {/* Prompt */}
        <div className="landing-stagger-3 mb-5">
          <LandingPrompt
            value={promptValue}
            onChange={onPromptChange}
            onSend={onSend}
            placeholder={placeholder || 'Describe your app...'}
          />
        </div>

        {/* Suggestion pills */}
        <SuggestionButtons onSelect={onPromptChange} />

        {/* Loved by */}
        <div className="flex flex-col items-center gap-2.5 mt-12 landing-stagger-5">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2.5">
              {[
                { src: '/lovedby/alidar.png', alt: 'Alidar' },
                { src: '/lovedby/asadbek.jpeg', alt: 'Asadbek' },
                { src: '/lovedby/diyor.jpeg', alt: 'Diyor' },
                { src: '/lovedby/sardor.jpeg', alt: 'Sardor' },
                { src: '/lovedby/yunus.jpeg', alt: 'Yunus' },
              ].map((a) => (
                <Image
                  key={a.alt}
                  src={a.src}
                  alt={a.alt}
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-sm"
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-amber-400"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-[#8a8a8a]" style={{ fontWeight: 500 }}>
            Loved by <span className="text-[#505050] font-semibold">1,500+</span> builders &middot;{' '}
            <span className="text-[#505050] font-semibold">2k+</span> projects created &middot;{' '}
            <span className="text-[#505050] font-semibold">4.8+</span> stars
          </p>
        </div>

        {/* Supported by */}
        <div className="mt-8 landing-stagger-7">
          <p
            className="text-center text-[10px] text-[#c0c0c0] mb-4"
            style={{ fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            Supported by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
            <Image
              src="/google-for-startups.svg"
              alt="Google for Startups"
              width={180}
              height={28}
              className="h-5 sm:h-6 w-auto opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
            <Image
              src="/aws-startups.png"
              alt="AWS Startups"
              width={120}
              height={32}
              className="h-6 sm:h-7 w-auto opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
            <Image
              src="/cloudflare-logo.svg"
              alt="Cloudflare"
              width={130}
              height={32}
              className="h-6 sm:h-7 w-auto opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
            <Image
              src="/convex-logo.svg"
              alt="Convex"
              width={120}
              height={32}
              className="h-6 sm:h-7 w-auto opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
