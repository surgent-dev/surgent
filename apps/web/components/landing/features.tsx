'use client'

import {
  RocketLaunch,
  CurrencyDollar,
  ChatCircleText,
  Database,
  Robot,
  CreditCard,
  CheckCircle,
  Lock,
  Code,
  Lightning,
  ArrowUpRight,
  TerminalWindow,
  Globe,
  Cpu,
  ShieldCheck,
  GitBranch,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

/* ─── UI Components ─── */

function PublishCard() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 pb-24 relative overflow-hidden group bg-white">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[length:24px_24px]" />

      {/* Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-violet-500/5 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-[320px]">
        {/* Status Badge */}
        <div
          className={cn(
            'flex items-center gap-3 px-5 py-2.5 rounded-full font-medium text-[13px] transition-all duration-500 border shadow-sm backdrop-blur-md',
            step === 0 && 'bg-white/80 text-zinc-600 border-zinc-200/80',
            step === 1 && 'bg-white/80 text-violet-600 border-violet-200/80 shadow-violet-100/50',
            step === 2 &&
              'bg-emerald-50/80 text-emerald-600 border-emerald-200/80 shadow-emerald-50/50',
          )}
        >
          {step === 0 && <GitBranch className="w-4 h-4" weight="duotone" />}
          {step === 1 && (
            <Lightning className="w-4 h-4 animate-pulse text-violet-500" weight="duotone" />
          )}
          {step === 2 && <Globe className="w-4 h-4" weight="duotone" />}

          <span className="font-mono tracking-tight">
            {step === 0 && 'git push origin main'}
            {step === 1 && 'Building & Deploying...'}
            {step === 2 && 'surgent.app/live'}
          </span>
        </div>

        {/* Visual Pipeline */}
        <div className="w-full space-y-3">
          <div className="flex justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-widest px-1">
            <span
              className={cn('transition-colors duration-300', step >= 0 ? 'text-zinc-700' : '')}
            >
              Source
            </span>
            <span
              className={cn('transition-colors duration-300', step >= 1 ? 'text-violet-600' : '')}
            >
              Build
            </span>
            <span
              className={cn('transition-colors duration-300', step >= 2 ? 'text-emerald-600' : '')}
            >
              Edge
            </span>
          </div>

          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden relative">
            <div
              className={cn(
                'absolute inset-y-0 left-0 bg-linear-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_10px_rgba(139,92,246,0.3)]',
                step === 0 ? 'w-[10%]' : step === 1 ? 'w-[60%]' : 'w-full',
              )}
            />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between px-0.5 -mt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-2.5 h-2.5 rounded-full border-2 transition-colors duration-500 z-10',
                  step >= i
                    ? 'bg-white border-violet-500 shadow-[0_0_0_2px_rgba(139,92,246,0.1)]'
                    : 'bg-zinc-50 border-zinc-200',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonetizationCard() {
  return (
    <div className="flex flex-col h-full p-6 pb-20 relative overflow-hidden group bg-white">
      <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-50 rounded-xl border border-zinc-100">
            <CurrencyDollar className="w-4 h-4 text-emerald-600" weight="duotone" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-zinc-900">Revenue</span>
            <span className="text-[10px] text-zinc-500 font-medium">Last 30 days</span>
          </div>
        </div>
        <span className="text-[11px] font-mono font-medium text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <ArrowUpRight className="w-3 h-3" weight="bold" />
          12.5%
        </span>
      </div>

      <div className="flex-1 flex items-end gap-2 px-1 relative z-10">
        {[35, 55, 45, 70, 65, 85].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end group/bar relative">
            <div
              className={cn(
                'w-full rounded-t-[4px] transition-all duration-700 ease-out relative overflow-hidden',
                i === 5
                  ? 'bg-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.2)]'
                  : 'bg-zinc-100 group-hover:bg-zinc-200',
              )}
              style={{ height: `${h}%` }}
            >
              {i === 5 && (
                <div className="absolute inset-0 bg-linear-to-t from-black/10 to-transparent" />
              )}
            </div>
            {i === 5 && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg translate-y-2 group-hover:translate-y-0">
                $4,250
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentsCard() {
  return (
    <div className="h-full p-6 pb-20 flex flex-col justify-center items-center relative overflow-hidden group bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[length:16px_16px] opacity-30" />

      <div className="w-full max-w-[260px] bg-white/90 backdrop-blur-xl rounded-2xl border border-zinc-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 space-y-6 rotate-1 group-hover:rotate-0 group-hover:scale-105 transition-all duration-500 ease-out relative z-10">
        <div className="flex items-center justify-between">
          <div className="w-12 h-8 bg-linear-to-br from-zinc-800 to-zinc-950 rounded-lg flex items-center justify-center shadow-inner">
            <div className="flex -space-x-1.5">
              <div className="w-4 h-4 rounded-full border border-white/10 bg-white/20 backdrop-blur-sm" />
              <div className="w-4 h-4 rounded-full border border-white/10 bg-white/20 backdrop-blur-sm" />
            </div>
          </div>
          <div className="w-16 h-2.5 bg-zinc-100 rounded-full" />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono tracking-widest">
            <span>CARD NUMBER</span>
          </div>
          <div className="h-2.5 w-full bg-zinc-50 rounded-full" />
          <div className="flex gap-4">
            <div className="h-2.5 w-1/3 bg-zinc-50 rounded-full" />
            <div className="h-2.5 w-1/4 bg-zinc-50 rounded-full" />
          </div>
        </div>

        <div className="pt-5 border-t border-zinc-100 flex justify-between items-center">
          <div className="text-[13px] font-semibold text-zinc-900">$24.00</div>
          <div className="px-4 py-1.5 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-sm hover:bg-zinc-800 transition-colors cursor-default flex items-center gap-1.5">
            <span>Pay</span>
            <ArrowUpRight className="w-3 h-3" weight="bold" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatbotCard() {
  return (
    <div className="h-full p-8 pb-24 flex flex-col justify-center relative overflow-hidden group bg-white">
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 blur-[80px] rounded-full" />

      <div className="space-y-5 w-full max-w-[320px] mx-auto relative z-10">
        {/* User Message */}
        <div className="flex gap-3 group/msg items-end">
          <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 shadow-sm">
            <div className="w-4 h-4 bg-zinc-300 rounded-full" />
          </div>
          <div className="bg-white border border-zinc-200/80 px-4 py-3 rounded-2xl rounded-bl-none text-[13px] text-zinc-600 shadow-[0_2px_8px_rgba(0,0,0,0.02)] group-hover/msg:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300">
            How do I add authentication?
          </div>
        </div>

        {/* AI Message */}
        <div className="flex gap-3 flex-row-reverse group/ai items-end">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
            <Robot className="w-4 h-4 text-white" weight="duotone" />
          </div>
          <div className="bg-violet-50/50 border border-violet-100 px-4 py-3 rounded-2xl rounded-br-none text-[13px] text-zinc-700 shadow-[0_2px_8px_rgba(124,58,237,0.04)] group-hover/ai:shadow-[0_4px_12px_rgba(124,58,237,0.08)] transition-all duration-300">
            <span className="text-violet-700 font-medium">@auth/client</span> is pre-configured.
            Just use the{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-violet-200 text-[11px] font-mono text-violet-600 mx-1">
              useAuth
            </code>{' '}
            hook.
          </div>
        </div>
      </div>
    </div>
  )
}

function AIModelsCard() {
  return (
    <div className="h-full p-6 pb-20 flex flex-col justify-center items-center relative overflow-hidden bg-white">
      <div className="space-y-3 w-full max-w-[220px]">
        {[
          { name: 'Claude 3.5 Sonnet', active: true, provider: 'Anthropic' },
          { name: 'GPT-4o', active: false, provider: 'OpenAI' },
          { name: 'Llama 3 70B', active: false, provider: 'Meta' },
        ].map((model, i) => (
          <div
            key={model.name}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 cursor-default group',
              model.active
                ? 'bg-white border-violet-200 shadow-[0_4px_16px_rgba(124,58,237,0.06)] scale-[1.02] z-10'
                : 'bg-zinc-50/50 border-transparent hover:bg-white hover:border-zinc-200 hover:shadow-sm',
            )}
          >
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-white transition-all duration-300',
                model.active
                  ? 'bg-violet-500 ring-violet-100'
                  : 'bg-zinc-300 ring-transparent group-hover:bg-zinc-400',
              )}
            />
            <div className="flex flex-col">
              <span
                className={cn(
                  'text-[13px] font-medium transition-colors',
                  model.active ? 'text-zinc-900' : 'text-zinc-600',
                )}
              >
                {model.name}
              </span>
            </div>
            {model.active && (
              <CheckCircle className="w-4 h-4 text-violet-500 ml-auto" weight="fill" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DatabaseCard() {
  return (
    <div className="h-full flex flex-col pb-16 relative overflow-hidden group bg-white">
      <div className="flex-1 grid grid-cols-2 divide-x divide-zinc-100 relative z-10">
        {/* Dev */}
        <div className="p-8 flex flex-col items-center justify-center gap-5 bg-zinc-50/30">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center border border-zinc-200 shadow-sm group-hover:scale-105 transition-transform duration-500">
            <Code className="w-6 h-6 text-zinc-400" weight="duotone" />
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold text-zinc-900 uppercase tracking-widest mb-1.5">
              Development
            </div>
            <div className="text-[11px] text-zinc-500 bg-white px-2.5 py-1 rounded-full border border-zinc-100 shadow-sm">
              Local Sandbox
            </div>
          </div>
        </div>

        {/* Prod */}
        <div className="p-8 flex flex-col items-center justify-center gap-5 bg-linear-to-b from-white to-violet-50/20">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center border border-violet-100 shadow-[0_8px_24px_rgba(124,58,237,0.08)] group-hover:scale-105 transition-transform duration-500">
            <ShieldCheck className="w-6 h-6 text-violet-600" weight="duotone" />
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold text-violet-900 uppercase tracking-widest mb-1.5">
              Production
            </div>
            <div className="text-[11px] text-violet-600 bg-violet-50/50 px-2.5 py-1 rounded-full border border-violet-100">
              Encrypted & Safe
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="h-12 border-t border-zinc-100 flex items-center justify-center gap-3 bg-white relative z-20">
        <Database className="w-4 h-4 text-zinc-400" weight="duotone" />
        <span className="text-[12px] font-mono text-zinc-500">postgres-v16-primary</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            Connected
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

const features = [
  {
    title: 'Instant Deploy',
    description: 'Push to git. We handle the build, deploy, and global distribution.',
    colSpan: 'md:col-span-2',
    ui: <PublishCard />,
    icon: RocketLaunch,
    stagger: 'landing-stagger-1',
  },
  {
    title: 'Sell Templates',
    description: 'Turn your code into a revenue stream with built-in marketplace tools.',
    colSpan: 'md:col-span-1',
    ui: <MonetizationCard />,
    icon: CurrencyDollar,
    stagger: 'landing-stagger-2',
  },
  {
    title: 'AI Models',
    description: 'One API for GPT-4, Claude 3.5, and Llama. Zero friction switching.',
    colSpan: 'md:col-span-1',
    ui: <AIModelsCard />,
    icon: Robot,
    stagger: 'landing-stagger-3',
  },
  {
    title: 'Secure Database',
    description: 'Isolated environments for development and production. Auto-migrated.',
    colSpan: 'md:col-span-2',
    ui: <DatabaseCard />,
    icon: Database,
    stagger: 'landing-stagger-4',
  },
  {
    title: 'Built-in Payments',
    description: 'Stripe integration is pre-configured. Just add your keys.',
    colSpan: 'md:col-span-1',
    ui: <PaymentsCard />,
    icon: CreditCard,
    stagger: 'landing-stagger-5',
  },
  {
    title: 'AI Assistant',
    description: 'Context-aware coding help that knows your entire codebase.',
    colSpan: 'md:col-span-2',
    ui: <ChatbotCard />,
    icon: ChatCircleText,
    stagger: 'landing-stagger-6',
  },
]

export function LandingFeatures() {
  return (
    <section className="py-32 px-5 sm:px-6 bg-white border-t border-zinc-100 overflow-hidden">
      <div className="mx-auto max-w-5xl">
        <div className="mb-20 md:text-center max-w-2xl mx-auto space-y-6">
          <h2 className="font-(--font-satoshi) font-bold tracking-tight text-zinc-900 sm:text-5xl landing-stagger-1">
            Everything you need to ship
          </h2>
          <p className="text-[17px] text-zinc-500 leading-relaxed font-medium landing-stagger-2">
            From first line of code to first dollar earned. Surgent provides the complete stack for
            modern apps, pre-configured and ready to scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[340px]">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={cn(
                'group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-all duration-500 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] hover:border-zinc-300/80',
                feature.colSpan,
                feature.stagger,
              )}
            >
              {/* Card Background & Hover Effect */}
              <div className="absolute inset-0 z-0 bg-zinc-50/30 group-hover:bg-zinc-50/60 transition-colors duration-500" />

              {/* Feature UI */}
              <div className="absolute inset-0 z-10">{feature.ui}</div>

              {/* Content Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-8 bg-white/90 backdrop-blur-xl border-t border-zinc-100 z-20 transition-transform duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-50 text-zinc-500 group-hover:bg-violet-50 group-hover:text-violet-600 transition-colors duration-300 border border-zinc-100 group-hover:border-violet-100">
                      <feature.icon className="w-5 h-5" weight="duotone" />
                    </div>
                    <h3 className="font-semibold text-[15px] text-zinc-900 tracking-tight">
                      {feature.title}
                    </h3>
                  </div>
                  <ArrowUpRight
                    className="w-4 h-4 text-zinc-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out"
                    weight="bold"
                  />
                </div>
                <p className="text-[14px] text-zinc-500 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
