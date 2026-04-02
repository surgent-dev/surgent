'use client'

import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Browser,
  ShoppingCart,
  Megaphone,
  CalendarCheck,
  Briefcase,
  User,
  Article,
  AppWindow,
} from '@phosphor-icons/react'

const siteTypes = [
  { label: 'Web App', desc: 'SaaS, dashboard, or tool', icon: AppWindow, color: '#14b8a6' },
  { label: 'Business Website', desc: 'Company or brand presence', icon: Browser, color: '#3b82f6' },
  { label: 'Landing Page', desc: 'Lead gen or sales funnel', icon: Megaphone, color: '#ef4444' },
  {
    label: 'Online Store',
    desc: 'Sell products or services',
    icon: ShoppingCart,
    color: '#f59e0b',
  },
  {
    label: 'Booking Site',
    desc: 'Appointments & scheduling',
    icon: CalendarCheck,
    color: '#84cc16',
  },
  { label: 'Portfolio', desc: 'Showcase your work', icon: Briefcase, color: '#6366f1' },
  { label: 'Personal Site', desc: 'Resume or blog', icon: User, color: '#0ea5e9' },
  { label: 'Blog / Content', desc: 'Articles & resources', icon: Article, color: '#a855f7' },
]

const goalOptions = [
  'Launch my business',
  'Validate an idea / MVP',
  'Get more customers',
  'Generate leads',
  'Sell online',
  'Book appointments',
  'Accept payments',
  'Build brand awareness',
  'Grow on social media',
  'Showcase my work',
]

const featureOptions = [
  { id: 'website', label: 'Website', desc: 'Custom site built by AI' },
  { id: 'sales-agent', label: 'AI Sales Agent', desc: 'Chat that converts visitors 24/7' },
  { id: 'lead-capture', label: 'Lead Capture', desc: 'Forms, popups & funnels' },
  { id: 'crm', label: 'CRM', desc: 'Manage contacts & deals' },
  { id: 'email-marketing', label: 'Email Marketing', desc: 'Campaigns & newsletters' },
  { id: 'cold-outreach', label: 'Cold Outreach', desc: 'Automated email sequences' },
  { id: 'social-media', label: 'Social Media', desc: 'Scheduling & auto-posting' },
  { id: 'paid-ads', label: 'Paid Ads', desc: 'Facebook & Google ads' },
  { id: 'seo', label: 'SEO', desc: 'Rank higher on Google' },
  { id: 'geo', label: 'GEO', desc: 'Get found in AI answers (ChatGPT, Gemini)' },
  { id: 'analytics', label: 'Analytics', desc: 'Track visitors & conversions' },
  { id: 'payments', label: 'Payments', desc: 'Invoicing & checkout links' },
  { id: 'booking', label: 'Booking', desc: 'Appointments & scheduling' },
]

type Data = {
  siteType: string
  services: string
  businessName: string
  goals: string[]
  customGoal: string
  features: string[]
  aboutYou: string
  prompt: string
}

function FadeIn({ children, step }: { children: React.ReactNode; step: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(false)
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => cancelAnimationFrame(t)
  }, [step])
  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      {children}
    </div>
  )
}

/* Shared checkbox */
function Check({ on }: { on: boolean }) {
  return (
    <div
      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${on ? 'bg-foreground border-foreground' : 'border-muted-foreground/25'}`}
    >
      {on && (
        <svg
          viewBox="0 0 12 12"
          className="w-2.5 h-2.5 text-background"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M2.5 6l2.5 2.5 4.5-5" />
        </svg>
      )}
    </div>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Data>({
    siteType: '',
    services: '',
    businessName: '',
    goals: [],
    customGoal: '',
    features: ['website'],
    aboutYou: '',
    prompt: '',
  })

  const totalSteps = 7
  const questions = [
    'What are you building?',
    'What services or products do you offer?',
    "What's your business called?",
    'What are your goals?',
    'What tools do you need?',
    'Tell us about yourself',
    'Review & generate',
  ]

  const buildPrompt = useCallback(() => {
    const allGoals = [...data.goals, ...(data.customGoal.trim() ? [data.customGoal.trim()] : [])]
    let prompt = `I want to build a ${data.siteType || 'website'}`
    if (data.businessName) prompt += ` called "${data.businessName}"`
    prompt += '.'
    if (data.services) prompt += ` We offer ${data.services}.`
    if (allGoals.length) prompt += ` Our main goal is to ${allGoals.join(', ').toLowerCase()}.`
    if (data.features.length) prompt += ` We need: ${data.features.join(', ')}.`
    if (data.aboutYou) prompt += ` About me: ${data.aboutYou}.`
    return prompt
  }, [data])

  const canContinue = () => {
    if (step === 0) return data.siteType.trim().length > 0
    if (step === 1) return true
    if (step === 2) return true
    if (step === 3) return data.goals.length > 0 || data.customGoal.trim().length > 0
    if (step === 4) return data.features.length > 0
    if (step === 5) return true
    if (step === 6) return data.prompt.trim().length > 0
    return true
  }

  const next = useCallback(() => {
    if (step === 5) {
      // Moving to review — generate prompt
      setData((d) => ({ ...d, prompt: buildPrompt() }))
      setStep(6)
    } else if (step < totalSteps - 1) {
      setStep((s) => s + 1)
    } else {
      try {
        sessionStorage.setItem('surgent:onboarding', JSON.stringify(data))
      } catch {}
      router.push(`/project/new?prompt=${encodeURIComponent(data.prompt)}`)
    }
  }, [step, data, buildPrompt, router])

  const back = () => (step > 0 ? setStep((s) => s - 1) : router.push('/'))
  const toggle = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      canContinue() &&
      !(e.target instanceof HTMLTextAreaElement)
    )
      next()
  }

  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const aboutRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (step === 0 || step === 2 || step === 3) setTimeout(() => inputRef.current?.focus(), 400)
    if (step === 1) setTimeout(() => textareaRef.current?.focus(), 400)
    if (step === 5) setTimeout(() => aboutRef.current?.focus(), 400)
    if (step === 6) setTimeout(() => promptRef.current?.focus(), 400)
  }, [step])

  return (
    <div
      className="h-dvh flex flex-col bg-white dark:bg-background text-foreground"
      onKeyDown={handleKeyDown}
    >
      <main className="flex-1 flex flex-col items-center px-6 sm:px-10 pt-[16vh] sm:pt-[18vh] overflow-auto pb-8">
        <div className="w-full max-w-xl">
          <FadeIn step={step}>
            {/* Header */}
            <div className="flex items-baseline justify-between mb-8">
              <h1 className="font-display text-2xl sm:text-3xl text-foreground">
                {questions[step]}
              </h1>
              <span className="text-xs text-muted-foreground/25 font-mono shrink-0 ml-4">
                {step + 1}/{totalSteps}
              </span>
            </div>

            {/* Step 1: Site type */}
            {step === 0 && (
              <div className="space-y-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={data.siteType}
                  onChange={(e) => setData((d) => ({ ...d, siteType: e.target.value }))}
                  placeholder="Or describe it in your own words"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {siteTypes.map((type) => {
                    const Icon = type.icon
                    const selected = data.siteType === type.label
                    return (
                      <button
                        key={type.label}
                        onClick={() => setData((d) => ({ ...d, siteType: type.label }))}
                        className={`flex flex-col gap-2 px-3 py-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                          selected
                            ? 'border-foreground/25 bg-muted'
                            : 'border-border hover:border-foreground/15 hover:bg-muted/50'
                        }`}
                      >
                        <Icon weight="regular" className="w-4 h-4" style={{ color: type.color }} />
                        <div>
                          <span
                            className={`text-[13px] block leading-tight ${selected ? 'text-foreground' : 'text-foreground/80'}`}
                          >
                            {type.label}
                          </span>
                          <span
                            className={`text-[11px] block mt-0.5 leading-tight ${selected ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}
                          >
                            {type.desc}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Services */}
            {step === 1 && (
              <div>
                <textarea
                  ref={textareaRef}
                  value={data.services}
                  onChange={(e) => setData((d) => ({ ...d, services: e.target.value }))}
                  placeholder="e.g. 1-on-1 coaching, group classes, meal plans, online programs..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors resize-none"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-2">
                  This helps us write better content for your site.
                </p>
              </div>
            )}

            {/* Step 3: Name */}
            {step === 2 && (
              <input
                ref={inputRef}
                type="text"
                value={data.businessName}
                onChange={(e) => setData((d) => ({ ...d, businessName: e.target.value }))}
                placeholder="Your business name"
                className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
              />
            )}

            {/* Step 4: Goals */}
            {step === 3 && (
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={data.customGoal}
                  onChange={(e) => setData((d) => ({ ...d, customGoal: e.target.value }))}
                  placeholder="Type your own goal..."
                  className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <div className="grid grid-cols-2 gap-2">
                  {goalOptions.map((goal) => {
                    const selected = data.goals.includes(goal)
                    return (
                      <button
                        key={goal}
                        onClick={() => setData((d) => ({ ...d, goals: toggle(d.goals, goal) }))}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                          selected
                            ? 'border-foreground/25 bg-muted'
                            : 'border-border/80 hover:border-foreground/15 hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`text-[13px] ${selected ? 'text-foreground' : 'text-foreground/70'}`}
                        >
                          {goal}
                        </span>
                        <Check on={selected} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Features */}
            {step === 4 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {featureOptions.map((f) => {
                  const selected = data.features.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      onClick={() => setData((d) => ({ ...d, features: toggle(d.features, f.id) }))}
                      className={`flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                        selected
                          ? 'border-foreground/25 bg-muted'
                          : 'border-border/80 hover:border-foreground/15 hover:bg-muted/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className={`text-[13px] block leading-tight ${selected ? 'text-foreground' : 'text-foreground/70'}`}
                        >
                          {f.label}
                        </span>
                        <span
                          className={`text-[11px] block mt-0.5 leading-tight ${selected ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                        >
                          {f.desc}
                        </span>
                      </div>
                      <div className="mt-0.5">
                        <Check on={selected} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 6: About you */}
            {step === 5 && (
              <div>
                <textarea
                  ref={aboutRef}
                  value={data.aboutYou}
                  onChange={(e) => setData((d) => ({ ...d, aboutYou: e.target.value }))}
                  placeholder="e.g. I'm a fitness coach based in NYC, 5 years of experience, looking to take my business online..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors resize-none"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-2">
                  Your background helps us tailor everything to you.
                </p>
              </div>
            )}

            {/* Step 7: Review */}
            {step === 6 &&
              (() => {
                const allGoals = [
                  ...data.goals,
                  ...(data.customGoal.trim() ? [data.customGoal.trim()] : []),
                ]
                return (
                  <div className="space-y-8">
                    {/* Summary sentence */}
                    <p className="text-[15px] leading-[2.2] text-foreground/80">
                      I want to build a{' '}
                      <span className="font-medium text-blue-500 underline decoration-wavy decoration-blue-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                        {data.siteType || 'website'}
                      </span>
                      {data.businessName && (
                        <>
                          {' '}
                          called{' '}
                          <span className="font-medium text-violet-500 underline decoration-wavy decoration-violet-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(139,92,246,0.2)]">
                            {data.businessName}
                          </span>
                        </>
                      )}
                      {data.services && (
                        <>
                          . We offer{' '}
                          <span className="font-medium text-amber-500 underline decoration-wavy decoration-amber-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                            {data.services}
                          </span>
                        </>
                      )}
                      {allGoals.length > 0 && (
                        <>
                          . The goal is to{' '}
                          {allGoals.map((g, i, arr) => (
                            <span key={g}>
                              <span className="font-medium text-emerald-500 underline decoration-wavy decoration-emerald-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                                {g.toLowerCase()}
                              </span>
                              {i < arr.length - 1 && (i === arr.length - 2 ? ' & ' : ', ')}
                            </span>
                          ))}
                        </>
                      )}
                      {data.features.length > 0 && (
                        <>
                          . Set up{' '}
                          {data.features.map((f, i, arr) => (
                            <span key={f}>
                              <span className="font-medium text-brand underline decoration-wavy decoration-brand/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(124,92,252,0.2)]">
                                {f}
                              </span>
                              {i < arr.length - 1 && (i === arr.length - 2 ? ' & ' : ', ')}
                            </span>
                          ))}
                        </>
                      )}
                      .
                    </p>

                    {/* Editable prompt */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] text-muted-foreground/50">Your prompt</label>
                        <span className="text-[11px] text-muted-foreground/30">Edit to refine</span>
                      </div>
                      <textarea
                        ref={promptRef}
                        value={data.prompt}
                        onChange={(e) => setData((d) => ({ ...d, prompt: e.target.value }))}
                        rows={4}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-muted/70 text-sm text-foreground leading-relaxed outline-none focus:border-foreground/20 transition-colors resize-y"
                      />
                    </div>
                  </div>
                )
              })()}

            {/* Actions */}
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={back}
                className="text-xs text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                {(step === 1 || step === 2 || step === 5) && (
                  <button
                    onClick={next}
                    className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={next}
                  disabled={!canContinue()}
                  className={`inline-flex items-center h-9 px-5 rounded-[0.5rem] text-sm font-medium cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 ${
                    step === totalSteps - 1 ? 'btn-brand' : 'btn-brand-secondary'
                  }`}
                >
                  {step === totalSteps - 1
                    ? 'Build my business →'
                    : step === totalSteps - 2
                      ? 'Review'
                      : 'Continue'}
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </main>
    </div>
  )
}

export default function GetStartedPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
