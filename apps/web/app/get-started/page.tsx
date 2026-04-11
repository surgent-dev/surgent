'use client'

import {
  Barbell,
  BookOpenText,
  Briefcase,
  Buildings,
  DotsThree,
  ForkKnife,
  Globe,
  GraduationCap,
  Laptop,
  MagnifyingGlass,
  Megaphone,
  Palette,
  Plus,
  Rocket,
  ShoppingBag,
  Sparkle,
  Storefront,
  Trash,
  User,
  Wrench,
} from '@phosphor-icons/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

/* ─── Option data ─── */

const identityOptions = [
  {
    value: 'Small business owner',
    desc: 'Running or starting a business',
    icon: Storefront,
    color: '#3b82f6',
  },
  {
    value: 'Freelancer or consultant',
    desc: 'Offering services independently',
    icon: User,
    color: '#14b8a6',
  },
  {
    value: 'Startup founder',
    desc: 'Building a product or side project',
    icon: Rocket,
    color: '#f59e0b',
  },
  {
    value: 'Agency or marketer',
    desc: 'Working with clients',
    icon: Megaphone,
    color: '#ef4444',
  },
  {
    value: 'Student',
    desc: 'Learning or building for school',
    icon: GraduationCap,
    color: '#6366f1',
  },
  {
    value: 'Just exploring',
    desc: "Checking out what's possible",
    icon: MagnifyingGlass,
    color: '#a855f7',
  },
]

const goalOptions = [
  'Launch my business online',
  'Get more customers & leads',
  'Start selling products or services',
  'Build my brand & social presence',
  'Validate an idea fast',
  'Replace my current website',
]

const industryOptions = [
  { value: 'Health & Fitness', icon: Barbell, color: '#ef4444' },
  { value: 'Food & Restaurant', icon: ForkKnife, color: '#f59e0b' },
  { value: 'Beauty & Wellness', icon: Sparkle, color: '#ec4899' },
  { value: 'Home Services', icon: Wrench, color: '#84cc16' },
  { value: 'Professional Services', icon: Briefcase, color: '#3b82f6' },
  { value: 'Real Estate', icon: Buildings, color: '#14b8a6' },
  { value: 'Education & Coaching', icon: BookOpenText, color: '#6366f1' },
  { value: 'Retail & E-commerce', icon: ShoppingBag, color: '#f97316' },
  { value: 'Tech & Software', icon: Laptop, color: '#0ea5e9' },
  { value: 'Creative & Design', icon: Palette, color: '#a855f7' },
  { value: 'Other', icon: DotsThree, color: '#737373' },
]

const stageOptions = [
  { value: 'Just an idea', desc: "Haven't started yet" },
  { value: 'Started, no website yet', desc: 'Need to get online' },
  { value: 'Have a website', desc: 'But need a better one' },
  { value: 'Have customers', desc: 'Ready to grow & scale' },
]

const audienceOptions = [
  { value: 'Individual consumers', desc: 'Selling to people (B2C)' },
  { value: 'Other businesses', desc: 'Selling to companies (B2B)' },
  { value: 'Both', desc: 'B2B and B2C' },
  { value: 'Not sure yet', desc: 'Still figuring it out' },
]

/* ─── Types ─── */

type Data = {
  identity: string
  goal: string
  industry: string
  businessName: string
  location: string
  stage: string
  audience: string
  referenceUrls: string[]
}

const stepMeta = [
  { question: 'What best describes you?', hint: 'This helps us tailor everything to your needs' },
  { question: "What's your #1 goal?", hint: "We'll prioritize the tools that matter most" },
  { question: 'What industry are you in?', hint: 'So we generate relevant content and design' },
  { question: 'Tell us about your business', hint: 'Used to personalize your site' },
  { question: 'How far along are you?', hint: 'Helps us set the right starting point' },
  {
    question: 'Who are your customers?',
    hint: 'So we write the right messaging for your audience',
  },
  {
    question: 'Any websites you love?',
    hint: "Share sites you like or your own — we'll use them as inspiration",
  },
  { question: 'Review & generate', hint: 'Edit anything before we build' },
]

/* ─── Prompt builder ─── */

function buildPrompt(d: Data, initialPrompt: string): string {
  let prompt = ''
  if (initialPrompt) {
    prompt = initialPrompt.endsWith('.') ? initialPrompt : initialPrompt + '.'
    prompt += '\n\n'
  }

  const parts: string[] = []
  if (d.industry && d.industry !== 'Other') {
    parts.push(`I need a professional ${d.industry.toLowerCase()} website`)
  } else if (!initialPrompt) {
    parts.push('I need a professional business website')
  }
  if (d.businessName) parts.push(`for "${d.businessName}"`)
  if (d.location) parts.push(`based in ${d.location}`)
  if (parts.length) prompt += parts.join(' ') + '.'

  const goalMap: Record<string, string> = {
    'Launch my business online':
      'My primary goal is to establish a strong online presence and launch my business.',
    'Get more customers & leads':
      'My primary goal is to attract new customers and capture leads effectively.',
    'Start selling products or services':
      'My primary goal is to sell products and services online.',
    'Build my brand & social presence':
      'My primary goal is to build brand awareness and grow my social media presence.',
    'Validate an idea fast': 'I need to validate this idea quickly with a compelling landing page.',
    'Replace my current website':
      'I need a modern, high-converting website to replace my current one.',
  }
  if (d.goal && goalMap[d.goal]) prompt += ' ' + goalMap[d.goal]

  if (d.audience === 'Individual consumers')
    prompt += ' My target customers are individual consumers.'
  else if (d.audience === 'Other businesses') prompt += ' I sell to other businesses (B2B).'
  else if (d.audience === 'Both') prompt += ' I serve both businesses and individual consumers.'

  if (d.stage === 'Have customers') prompt += ' I already have customers and need to scale.'
  else if (d.stage === 'Just an idea')
    prompt += ' This is a new venture that needs to look credible from day one.'

  // Infer features from profile
  const features = new Set<string>()
  if (d.goal === 'Get more customers & leads') {
    features.add('lead capture forms')
    features.add('SEO')
    features.add('analytics')
  }
  if (d.goal === 'Start selling products or services') {
    features.add('payments')
    features.add('product showcase')
  }
  if (d.goal === 'Build my brand & social presence') {
    features.add('social media links')
    features.add('blog section')
  }
  if (d.goal === 'Validate an idea fast') {
    features.add('email signup')
    features.add('clear call-to-action')
  }
  if (d.identity === 'Freelancer or consultant') {
    features.add('booking')
    features.add('portfolio section')
  }
  if (d.identity === 'Agency or marketer') {
    features.add('portfolio')
    features.add('client testimonials')
  }
  if (d.industry === 'Food & Restaurant') {
    features.add('menu')
    features.add('reservations')
  }
  if (d.industry === 'Health & Fitness') {
    features.add('class schedule')
    features.add('booking')
  }
  if (d.industry === 'Real Estate') {
    features.add('property listings')
    features.add('contact forms')
  }
  if (d.industry === 'Retail & E-commerce') {
    features.add('product catalog')
    features.add('cart')
    features.add('checkout')
  }
  if (features.size) prompt += ` Include: ${[...features].join(', ')}.`

  if (d.referenceUrls.length > 0) {
    prompt += ` Use these websites as design and style inspiration: ${d.referenceUrls.join(', ')}.`
  }

  return prompt
}

/* ─── Components ─── */

function FadeIn({ children, step }: { children: React.ReactNode; step: number }) {
  return (
    <div key={step} className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
      {children}
    </div>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('prompt')?.trim() || ''

  const [step, setStep] = useState(0)
  const [data, setData] = useState<Data>({
    identity: '',
    goal: '',
    industry: '',
    businessName: '',
    location: '',
    stage: '',
    audience: '',
    referenceUrls: [],
  })
  const [finalPrompt, setFinalPrompt] = useState('')
  const [advancing, setAdvancing] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const goalInputRef = useRef<HTMLInputElement>(null)
  const industryInputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const reviewStep = stepMeta.length - 1
  const progress = ((step + 1) / stepMeta.length) * 100

  const advance = useCallback(
    (d: Data) => {
      if (step < reviewStep) {
        if (step === reviewStep - 1) {
          setFinalPrompt(buildPrompt(d, initialPrompt))
        }
        setStep((s) => s + 1)
      } else {
        const prompt = finalPrompt.trim()
        if (!prompt) return
        try {
          sessionStorage.setItem(
            'surgent:onboarding',
            JSON.stringify({ ...d, referenceUrls: d.referenceUrls, prompt }),
          )
        } catch {}
        router.push(`/project/new?prompt=${encodeURIComponent(prompt)}`)
      }
    },
    [step, reviewStep, initialPrompt, finalPrompt, router],
  )

  const selectAndAdvance = useCallback(
    (field: keyof Data, value: string) => {
      if (advancing) return
      const next = { ...data, [field]: value }
      setData(next)
      setAdvancing(true)
      setTimeout(() => {
        setAdvancing(false)
        advance(next)
      }, 350)
    },
    [data, advancing, advance],
  )

  const skip = useCallback(() => advance(data), [advance, data])
  const back = () => (step > 0 ? setStep((s) => s - 1) : router.push('/'))

  useEffect(() => {
    if (step === 1) setTimeout(() => goalInputRef.current?.focus(), 400)
    if (step === 2) setTimeout(() => industryInputRef.current?.focus(), 400)
    if (step === 3) setTimeout(() => nameRef.current?.focus(), 400)
    if (step === 6) setTimeout(() => urlInputRef.current?.focus(), 400)
    if (step === reviewStep) setTimeout(() => promptRef.current?.focus(), 400)
  }, [step, reviewStep])

  // Is the current value a custom (typed) entry vs a preset card?
  const isCustomGoal = data.goal !== '' && !goalOptions.includes(data.goal)
  const isCustomIndustry =
    data.industry !== '' && !industryOptions.some((o) => o.value === data.industry)

  const addReferenceUrl = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    setData((d) => ({ ...d, referenceUrls: [...d.referenceUrls, url] }))
    setUrlInput('')
    setTimeout(() => urlInputRef.current?.focus(), 50)
  }, [urlInput])

  const removeReferenceUrl = useCallback((index: number) => {
    setData((d) => ({ ...d, referenceUrls: d.referenceUrls.filter((_, i) => i !== index) }))
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement)) {
      if (step === 6) {
        e.preventDefault()
        addReferenceUrl()
      } else if (step === 1 || step === 2 || step === 3) {
        advance(data)
      }
    }
  }

  return (
    <div
      className="h-dvh flex flex-col bg-white dark:bg-background text-foreground"
      onKeyDown={handleKeyDown}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-border/50">
        <div
          className="h-full bg-foreground/20 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center px-6 sm:px-10 pt-[16vh] sm:pt-[18vh] overflow-auto pb-8">
        <div className="w-full max-w-xl">
          <FadeIn step={step}>
            {/* Header */}
            <div className="mb-8">
              <h1 className="font-display text-2xl sm:text-3xl text-foreground">
                {stepMeta[step]!.question}
              </h1>
              <p className="text-sm text-muted-foreground/60 mt-2">{stepMeta[step]!.hint}</p>
            </div>

            {/* Step 0: Identity */}
            {step === 0 && (
              <div className="grid grid-cols-2 gap-2">
                {identityOptions.map((opt) => {
                  const Icon = opt.icon
                  const on = data.identity === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectAndAdvance('identity', opt.value)}
                      className={`flex items-start gap-3 px-3.5 py-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                        on
                          ? 'border-foreground/25 bg-muted'
                          : 'border-border hover:border-foreground/15 hover:bg-muted/50'
                      }`}
                    >
                      <Icon
                        weight="regular"
                        className="w-[18px] h-[18px] mt-0.5 shrink-0"
                        style={{ color: opt.color }}
                      />
                      <div>
                        <span
                          className={`text-[13px] block leading-tight ${on ? 'text-foreground' : 'text-foreground/80'}`}
                        >
                          {opt.value}
                        </span>
                        <span
                          className={`text-[11px] block mt-0.5 leading-tight ${on ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 1: Goal */}
            {step === 1 && (
              <div className="space-y-3">
                <input
                  ref={goalInputRef}
                  type="text"
                  value={isCustomGoal ? data.goal : ''}
                  onChange={(e) => setData((d) => ({ ...d, goal: e.target.value }))}
                  placeholder="Or type your own goal..."
                  className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <div className="space-y-2">
                  {goalOptions.map((g) => {
                    const on = data.goal === g
                    return (
                      <button
                        key={g}
                        onClick={() => selectAndAdvance('goal', g)}
                        className={`w-full px-4 py-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                          on
                            ? 'border-foreground/25 bg-muted'
                            : 'border-border hover:border-foreground/15 hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`text-[13px] ${on ? 'text-foreground' : 'text-foreground/70'}`}
                        >
                          {g}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Industry */}
            {step === 2 && (
              <div className="space-y-3">
                <input
                  ref={industryInputRef}
                  type="text"
                  value={isCustomIndustry ? data.industry : ''}
                  onChange={(e) => setData((d) => ({ ...d, industry: e.target.value }))}
                  placeholder="Or type your industry..."
                  className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {industryOptions.map((opt) => {
                    const Icon = opt.icon
                    const on = data.industry === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => selectAndAdvance('industry', opt.value)}
                        className={`flex flex-col gap-2 px-3 py-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                          on
                            ? 'border-foreground/25 bg-muted'
                            : 'border-border hover:border-foreground/15 hover:bg-muted/50'
                        }`}
                      >
                        <Icon weight="regular" className="w-4 h-4" style={{ color: opt.color }} />
                        <span
                          className={`text-[13px] leading-tight ${on ? 'text-foreground' : 'text-foreground/80'}`}
                        >
                          {opt.value}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Business details */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-muted-foreground/50 mb-1.5 block">
                    Business name
                  </label>
                  <input
                    ref={nameRef}
                    type="text"
                    value={data.businessName}
                    onChange={(e) => setData((d) => ({ ...d, businessName: e.target.value }))}
                    placeholder="e.g. FitLife Coaching"
                    className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground/50 mb-1.5 block">
                    Location <span className="text-muted-foreground/30">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={data.location}
                    onChange={(e) => setData((d) => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. New York, NY"
                    className="w-full h-11 px-4 rounded-lg border border-border bg-muted/70 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Stage */}
            {step === 4 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stageOptions.map((opt) => {
                  const on = data.stage === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectAndAdvance('stage', opt.value)}
                      className={`px-4 py-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                        on
                          ? 'border-foreground/25 bg-muted'
                          : 'border-border hover:border-foreground/15 hover:bg-muted/50'
                      }`}
                    >
                      <span
                        className={`text-[13px] block leading-tight ${on ? 'text-foreground' : 'text-foreground/70'}`}
                      >
                        {opt.value}
                      </span>
                      <span
                        className={`text-[11px] block mt-0.5 leading-tight ${on ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 5: Audience */}
            {step === 5 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {audienceOptions.map((opt) => {
                  const on = data.audience === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectAndAdvance('audience', opt.value)}
                      className={`px-4 py-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                        on
                          ? 'border-foreground/25 bg-muted'
                          : 'border-border hover:border-foreground/15 hover:bg-muted/50'
                      }`}
                    >
                      <span
                        className={`text-[13px] block leading-tight ${on ? 'text-foreground' : 'text-foreground/70'}`}
                      >
                        {opt.value}
                      </span>
                      <span
                        className={`text-[11px] block mt-0.5 leading-tight ${on ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 6: Reference websites */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe
                      weight="regular"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40"
                    />
                    <input
                      ref={urlInputRef}
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="e.g. stripe.com, apple.com"
                      className="w-full h-11 pl-9 pr-4 rounded-lg border border-border bg-muted/70 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                    />
                  </div>
                  <button
                    onClick={addReferenceUrl}
                    disabled={!urlInput.trim()}
                    className="inline-flex items-center justify-center h-11 w-11 rounded-lg border border-border hover:border-foreground/15 hover:bg-muted/50 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <Plus weight="bold" className="w-4 h-4 text-foreground/70" />
                  </button>
                </div>
                {data.referenceUrls.length > 0 && (
                  <div className="space-y-2">
                    {data.referenceUrls.map((url, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-border bg-muted/30 group"
                      >
                        <Globe
                          weight="regular"
                          className="w-4 h-4 text-muted-foreground/50 shrink-0"
                        />
                        <span className="text-[13px] text-foreground/80 flex-1 truncate">
                          {url}
                        </span>
                        <button
                          onClick={() => removeReferenceUrl(i)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash
                            weight="regular"
                            className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-red-400 transition-colors"
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {data.referenceUrls.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/40 text-center pt-2">
                    Add websites you admire or your own — we'll match the style and vibe
                  </p>
                )}
              </div>
            )}

            {/* Step 7: Review */}
            {step === reviewStep && (
              <div className="space-y-8">
                {/* Summary sentence */}
                <p className="text-[15px] leading-[2.2] text-foreground/80">
                  {data.identity && (
                    <>
                      {"I'm a "}
                      <span className="font-medium text-blue-500 underline decoration-wavy decoration-blue-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                        {data.identity.toLowerCase()}
                      </span>
                    </>
                  )}
                  {data.industry && (
                    <>
                      {data.identity ? ' in ' : 'In the '}
                      <span className="font-medium text-violet-500 underline decoration-wavy decoration-violet-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(139,92,246,0.2)]">
                        {data.industry.toLowerCase()}
                      </span>
                    </>
                  )}
                  {data.businessName && (
                    <>
                      {data.identity || data.industry ? '. My business is called ' : 'Building '}
                      <span className="font-medium text-amber-500 underline decoration-wavy decoration-amber-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                        {data.businessName}
                      </span>
                    </>
                  )}
                  {data.location && (
                    <>
                      {' based in '}
                      <span className="font-medium text-teal-500 underline decoration-wavy decoration-teal-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(20,184,166,0.2)]">
                        {data.location}
                      </span>
                    </>
                  )}
                  {(data.identity || data.industry || data.businessName) && '. '}
                  {data.goal && (
                    <>
                      {'I want to '}
                      <span className="font-medium text-emerald-500 underline decoration-wavy decoration-emerald-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                        {data.goal.toLowerCase()}
                      </span>
                      .{' '}
                    </>
                  )}
                  {data.audience && data.audience !== 'Not sure yet' && (
                    <>
                      {'My customers are '}
                      <span className="font-medium text-brand underline decoration-wavy decoration-brand/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(124,92,252,0.2)]">
                        {data.audience.toLowerCase()}
                      </span>
                      .{' '}
                    </>
                  )}
                  {data.stage && (
                    <>
                      {"I'm at the "}
                      <span className="font-medium text-pink-500 underline decoration-wavy decoration-pink-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(236,72,153,0.2)]">
                        {`"${data.stage.toLowerCase()}"`}
                      </span>
                      {' stage.'}
                    </>
                  )}
                  {data.referenceUrls.length > 0 && (
                    <>
                      {' Inspired by '}
                      <span className="font-medium text-cyan-500 underline decoration-wavy decoration-cyan-400/25 underline-offset-3 drop-shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                        {data.referenceUrls.length === 1
                          ? data.referenceUrls[0]
                          : `${data.referenceUrls.length} websites`}
                      </span>
                      .
                    </>
                  )}
                  {Object.values(data).every((v) => (Array.isArray(v) ? v.length === 0 : !v)) && (
                    <span className="text-muted-foreground/50">
                      No details added yet — edit the prompt below.
                    </span>
                  )}
                </p>

                {/* Editable prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] text-muted-foreground/50">Your prompt</label>
                    <span className="text-[11px] text-muted-foreground/30">Edit to refine</span>
                  </div>
                  <textarea
                    ref={promptRef}
                    value={finalPrompt}
                    onChange={(e) => setFinalPrompt(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-muted/70 text-base sm:text-sm text-foreground leading-relaxed outline-none focus:border-foreground/20 transition-colors resize-y"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={back}
                className="text-xs text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
              >
                &larr; Back
              </button>
              <div className="flex items-center gap-3">
                {step !== reviewStep && (
                  <button
                    onClick={skip}
                    className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
                  >
                    Skip
                  </button>
                )}
                {(step === 3 ||
                  step === 6 ||
                  (step === 1 && isCustomGoal) ||
                  (step === 2 && isCustomIndustry)) && (
                  <button
                    onClick={() => advance(data)}
                    disabled={
                      step === 1 ? !data.goal.trim() : step === 2 ? !data.industry.trim() : false
                    }
                    className="inline-flex items-center h-9 px-5 rounded-[0.5rem] text-sm font-medium cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed btn-brand-secondary transition-all duration-300"
                  >
                    Continue
                  </button>
                )}
                {step === reviewStep && (
                  <button
                    onClick={() => advance(data)}
                    disabled={!finalPrompt.trim()}
                    className="inline-flex items-center h-9 px-5 rounded-[0.5rem] text-sm font-medium cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed btn-brand transition-all duration-300"
                  >
                    Build my business &rarr;
                  </button>
                )}
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
