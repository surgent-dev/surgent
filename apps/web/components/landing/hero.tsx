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
  'A SaaS dashboard with live charts and subscription billing...',
  'An online store with product pages, cart, and Stripe checkout...',
  'A booking app with calendar, payments, and email confirmations...',
  'A membership site with gated content and monthly plans...',
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
  const hasValue = value.trim().length > 0

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
      className="cursor-text relative flex flex-col gap-2 p-3.5 transition-all duration-150"
      style={{
        borderRadius: '1.75rem',
        background: 'hsl(60 3% 15%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: focused
          ? '0 0 0 0.5px #000000e0, 0 20px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 0 0 0.5px #000000e0, 0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.12), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 -1px 0 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={2}
        className="font-(--font-geist) w-full resize-none bg-transparent text-[#fdf8f0] text-[15px] leading-[1.6] placeholder:text-[#666] focus:outline-none px-1 pt-0.5"
        style={{ fontWeight: 400, letterSpacing: '-0.01em' }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-[#555]">
          <kbd
            className="inline-flex items-center justify-center h-[20px] px-1.5 rounded-md text-[10px] text-[#777]"
            style={{
              fontWeight: 500,
              background: 'rgba(255,255,255,0.06)',
              boxShadow:
                '0 0 0 0.5px rgba(255,255,255,0.06), 0 1px 1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            ↵
          </kbd>
          <span className="hidden sm:inline text-[#555]">to build</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSend()
          }}
          className="inline-flex items-center justify-center rounded-full size-8 text-white bg-brand hover:bg-brand/90 btn-elevated-brand cursor-pointer transition-all duration-100 active:scale-[0.97]"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ─── Suggestion buttons ─── */
function SuggestionButtons({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 landing-stagger-4">
      {suggestions.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.prompt)}
          className="font-(--font-geist) inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[#666] hover:text-[#bbb] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-100 cursor-pointer active:scale-[0.97]"
          style={{ fontWeight: 450, letterSpacing: '-0.01em' }}
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
    <section className="relative flex-1 flex flex-col items-center justify-center pt-24 pb-12 sm:pt-32 sm:pb-16 overflow-hidden">
      <div className="relative z-10 w-full max-w-[640px] mx-auto px-5 sm:px-6">
        {/* Headline */}
        <div className="text-center mb-8 sm:mb-10 landing-stagger-2">
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
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
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full border-2 border-background object-cover shadow-sm"
                  />
                ))}
              </div>
              <div className="h-5 w-px bg-[#333]" />
              <div className="flex items-center gap-1">
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
                <span className="text-[13px] text-[#999] font-semibold">4.8</span>
              </div>
            </div>
            <p
              className="font-(--font-geist) text-[12.5px] text-[#666]"
              style={{ fontWeight: 500 }}
            >
              Loved by <span className="text-[#999]">1,500+</span> builders &middot;{' '}
              <span className="text-[#999]">2k+</span> projects created
            </p>
          </div>
          <h1
            className="font-(--font-geist) text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem] leading-[1.1] tracking-[-0.04em] text-[#fdf8f0] mb-5"
            style={{ fontWeight: 800 }}
          >
            Build your app,
            <br />
            <span className="text-[#fdf8f0]/30">start earning today</span>
          </h1>
          <p
            className="font-(--font-geist) text-[#777] text-[14px] sm:text-[15.5px] max-w-[480px] mx-auto leading-[1.6]"
            style={{ fontWeight: 400, letterSpacing: '-0.01em' }}
          >
            Describe your idea in plain text — Surgent builds it, adds payments, and deploys it
            live. No setup, no code, no waiting.
          </p>
        </div>

        {/* Prompt */}
        <div className="landing-stagger-3 mb-6">
          <LandingPrompt
            value={promptValue}
            onChange={onPromptChange}
            onSend={onSend}
            placeholder={placeholder || 'Describe your app...'}
          />
        </div>

        {/* Suggestion pills */}
        <SuggestionButtons onSelect={onPromptChange} />
      </div>
    </section>
  )
}
