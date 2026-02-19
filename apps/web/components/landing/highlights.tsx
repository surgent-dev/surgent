'use client'

import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Abstract wireframe UIs rendered inside mock browser chrome ─── */

function DashboardUI() {
  return (
    <div className="flex h-full">
      <div className="w-12 bg-blue-500/5 border-r border-blue-500/10 flex flex-col items-center gap-2.5 py-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('w-5 h-5 rounded-md', i === 0 ? 'bg-blue-500/30' : 'bg-blue-500/10')}
          />
        ))}
      </div>
      <div className="flex-1 p-3 space-y-2.5">
        <div className="flex gap-2">
          {['bg-blue-500/20', 'bg-cyan-500/15', 'bg-teal-500/15'].map((c, i) => (
            <div key={i} className={cn('flex-1 h-14 rounded-lg', c)}>
              <div className="p-2 space-y-1">
                <div className="w-8 h-1.5 rounded-full bg-current opacity-20" />
                <div className="w-12 h-3 rounded bg-current opacity-10" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-24 rounded-lg bg-blue-500/8 p-2.5">
          <div className="flex items-end h-full gap-1.5 pb-1">
            {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 68].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-500/25 rounded-t-sm"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-10 rounded-lg bg-blue-500/8" />
          <div className="flex-1 h-10 rounded-lg bg-blue-500/8" />
        </div>
      </div>
    </div>
  )
}

function StoreUI() {
  return (
    <div className="p-3 space-y-2.5 h-full">
      <div className="flex items-center justify-between">
        <div className="w-16 h-2 rounded-full bg-purple-500/25" />
        <div className="flex gap-1.5">
          <div className="w-5 h-5 rounded-full bg-purple-500/15" />
          <div className="w-5 h-5 rounded-full bg-purple-500/15" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg bg-purple-500/8 p-2 flex flex-col">
            <div
              className={cn(
                'flex-1 min-h-10 rounded-md mb-1.5',
                i % 2 === 0 ? 'bg-purple-500/15' : 'bg-pink-500/12',
              )}
            />
            <div className="w-14 h-1.5 rounded-full bg-purple-500/20" />
            <div className="w-8 h-1.5 rounded-full bg-purple-500/12 mt-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

function BookingUI() {
  return (
    <div className="p-3 space-y-2.5 h-full">
      <div className="flex gap-2">
        <div className="w-20 h-2 rounded-full bg-orange-500/25" />
        <div className="ml-auto w-14 h-5 rounded-md bg-orange-500/20" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-3 flex items-center justify-center">
            <div className="w-3 h-1 rounded-full bg-orange-500/20" />
          </div>
        ))}
        {[...Array(28)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-md flex items-center justify-center',
              i === 8 || i === 14
                ? 'bg-orange-500/30'
                : i === 9 || i === 15
                  ? 'bg-amber-500/15'
                  : 'bg-orange-500/6',
            )}
          >
            <div className="w-1 h-1 rounded-full bg-orange-500/30" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-6 rounded-md bg-orange-500/10 flex items-center px-2 gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500/30" />
            <div className="w-16 h-1.5 rounded-full bg-orange-500/15" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AIWriterUI() {
  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r border-emerald-500/10 p-2.5 space-y-1.5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-5 rounded-md px-2 flex items-center',
              i === 1 ? 'bg-emerald-500/15' : 'bg-transparent',
            )}
          >
            <div
              className={cn(
                'h-1 rounded-full',
                i === 1 ? 'w-14 bg-emerald-500/40' : 'w-10 bg-emerald-500/12',
              )}
            />
          </div>
        ))}
      </div>
      <div className="flex-1 p-3 space-y-2">
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn('h-1.5 rounded-full bg-emerald-500/12', i === 4 ? 'w-2/3' : 'w-full')}
            />
          ))}
        </div>
        <div className="h-px bg-emerald-500/10" />
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={cn('h-1.5 rounded-full bg-green-500/10', i === 2 ? 'w-1/2' : 'w-full')}
            />
          ))}
        </div>
        <div className="mt-auto flex gap-1.5">
          <div className="h-6 flex-1 rounded-md bg-emerald-500/8" />
          <div className="h-6 w-14 rounded-md bg-emerald-500/25" />
        </div>
      </div>
    </div>
  )
}

function SocialUI() {
  return (
    <div className="flex h-full">
      <div className="w-14 border-r border-indigo-500/10 p-2 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-full aspect-square rounded-lg',
              i === 0 ? 'bg-indigo-500/25' : 'bg-indigo-500/8',
            )}
          />
        ))}
      </div>
      <div className="flex-1 p-3">
        <div className="flex gap-2 mb-3">
          {['bg-indigo-500/20', 'bg-violet-500/15', 'bg-fuchsia-500/12'].map((c, i) => (
            <div key={i} className={cn('flex-1 h-16 rounded-lg p-2', c)}>
              <div className="w-6 h-1.5 rounded-full bg-current opacity-20 mb-1" />
              <div className="w-10 h-3 rounded bg-current opacity-10" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 h-7 rounded-md bg-indigo-500/6 px-2">
              <div className="w-4 h-4 rounded-full bg-indigo-500/15 shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-indigo-500/12" />
              <div className="w-8 h-3.5 rounded bg-indigo-500/15 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Browser chrome wrapper ─── */

function BrowserFrame({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden border border-gray-200/60 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50/80 border-b border-gray-100">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-300/70" />
          <div className="w-2 h-2 rounded-full bg-gray-300/70" />
          <div className="w-2 h-2 rounded-full bg-gray-300/70" />
        </div>
        <div className="flex-1 mx-2 h-4 rounded-md bg-gray-100 max-w-40" />
      </div>
      <div className={cn('flex-1 overflow-hidden', accent)}>{children}</div>
    </div>
  )
}

/* ─── Data ─── */

const projects = [
  {
    name: 'Nexus Dashboard',
    description: 'Real-time SaaS analytics',
    colSpan: 'md:col-span-2 md:row-span-2',
    accent: 'bg-blue-50/40',
    ui: <DashboardUI />,
    url: '#',
  },
  {
    name: 'Vogue Store',
    description: 'Minimalist e-commerce',
    colSpan: 'md:col-span-1',
    accent: 'bg-purple-50/40',
    ui: <StoreUI />,
    url: '#',
  },
  {
    name: 'Zenith Booking',
    description: 'Smart scheduling',
    colSpan: 'md:col-span-1',
    accent: 'bg-orange-50/40',
    ui: <BookingUI />,
    url: '#',
  },
  {
    name: 'Echo AI Writer',
    description: 'LLM-powered content',
    colSpan: 'md:col-span-1',
    accent: 'bg-emerald-50/40',
    ui: <AIWriterUI />,
    url: '#',
  },
  {
    name: 'Pulse Social',
    description: 'Social media management',
    colSpan: 'md:col-span-2',
    accent: 'bg-indigo-50/40',
    ui: <SocialUI />,
    url: '#',
  },
]

/* ─── Section ─── */

export function LandingHighlights() {
  return (
    <section className="relative pt-8 pb-24 sm:pt-12 sm:pb-32 px-5 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:auto-rows-[200px]">
          {projects.map((project) => (
            <a
              key={project.name}
              href={project.url}
              className={cn(
                'group relative block overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                project.colSpan,
              )}
            >
              <BrowserFrame accent={project.accent}>{project.ui}</BrowserFrame>

              {/* Label overlay */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-linear-to-t from-white via-white/95 to-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{project.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">{project.description}</p>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
