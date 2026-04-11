'use client'

import { ArrowRight, ArrowSquareOut, PencilSimple } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { http } from '@/lib/http'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { useCreateProject } from '@/queries/projects'

const GH_URL = 'https://github.com/bahodirr/worker-vite-react-simple-template'

type Brief = {
  businessName: string
  tagline: string
  subtitle: string
  colors: string[]
  competitors: { name: string; url: string; note: string }[]
  uiStyle: string
  brief: string
  prompt: string
}

function readOnboarding() {
  try {
    const r = sessionStorage.getItem('surgent:onboarding')
    if (!r) return undefined
    sessionStorage.removeItem('surgent:onboarding')
    return JSON.parse(r)
  } catch {
    return undefined
  }
}

function host(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/* ─── Main ─── */

function Content() {
  const router = useRouter()
  const prompt = useSearchParams().get('prompt') || ''
  const create = useCreateProject()
  const started = useRef(false)
  const onboarding = useRef<any>(undefined)

  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!prompt) {
      router.replace('/')
      return
    }
    onboarding.current = readOnboarding()

    http
      .post('api/projects/enhance-prompt', {
        json: { ...onboarding.current, prompt },
        timeout: 60000,
      })
      .json<Brief>()
      .then((b) => {
        setBrief(b)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || 'Brief generation failed')
        setLoading(false)
      })
  }, [prompt, router])

  const handleStart = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const data = onboarding.current
      const { id } = await create.mutateAsync({
        name: brief?.businessName || data?.businessName || 'My Project',
        githubUrl: GH_URL,
        initConvex: false,
        metadata: data ? { onboarding: { ...data, prompt } } : undefined,
      })
      track('project_created', { project_id: id })
      router.replace(`/company/${id}/editor?initial=${encodeURIComponent(brief?.brief || prompt)}`)
    } catch (err: any) {
      setError(err?.message || 'Failed')
      setCreating(false)
    }
  }, [creating, brief, prompt, router, create])

  return (
    <div className="h-dvh flex flex-col bg-white dark:bg-background">
      <div className="h-1 bg-foreground/[0.04] shrink-0">
        <motion.div
          className="h-full rounded-r-full bg-brand shadow-[0_0_8px_rgba(124,92,252,0.4)]"
          initial={{ width: '0%' }}
          animate={{ width: loading ? '60%' : '100%' }}
          transition={{ duration: loading ? 12 : 0.5, ease: loading ? 'linear' : 'easeOut' }}
        />
      </div>

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <AnimatePresence mode="wait">
            {/* Skeleton */}
            {loading && !brief && (
              <motion.div key="sk" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div className="mb-8 sm:mb-10 space-y-2.5 animate-pulse">
                  <div className="h-8 sm:h-10 w-48 sm:w-72 rounded-xl bg-foreground/[0.05]" />
                  <div className="h-4 w-40 sm:w-56 rounded-lg bg-foreground/[0.03]" />
                  <div className="h-3 w-28 sm:w-36 rounded-lg bg-foreground/[0.025]" />
                </div>
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">
                  <div className="flex-1 space-y-3 animate-pulse">
                    {[100, 100, 98, 95, 100, 92, 88, 60].map((w, i) => (
                      <div
                        key={i}
                        className="h-[14px] sm:h-[15px] rounded-md bg-foreground/[0.03]"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                  <div className="hidden sm:block lg:w-64 shrink-0 space-y-6 animate-pulse">
                    <div>
                      <div className="h-3 w-14 rounded bg-foreground/[0.05] mb-3" />
                      <div className="flex gap-2">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex-1">
                            <div className="aspect-square rounded-xl bg-foreground/[0.04]" />
                            <div className="h-2 w-8 rounded bg-foreground/[0.025] mx-auto mt-1.5" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="h-3 w-24 rounded bg-foreground/[0.05] mb-3" />
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5 px-2.5">
                          <div className="size-4 rounded bg-foreground/[0.04] shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-28 rounded bg-foreground/[0.035]" />
                            <div className="h-2.5 w-36 rounded bg-foreground/[0.025]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-foreground/[0.04] flex justify-center animate-pulse">
                  <div className="h-11 sm:h-12 w-44 sm:w-52 rounded-full bg-foreground/[0.04]" />
                </div>
              </motion.div>
            )}

            {/* Error */}
            {!loading && error && !brief && (
              <motion.div
                key="err"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-20 sm:py-32 text-center"
              >
                <p className="text-sm text-muted-foreground/60 mb-2">Something went wrong</p>
                <p className="text-[12px] text-muted-foreground/40 max-w-xs mb-4">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="text-[13px] text-brand hover:underline cursor-pointer"
                >
                  Go back
                </button>
              </motion.div>
            )}

            {/* Brief */}
            {brief && (
              <motion.div
                key="brief"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div className="mb-8 sm:mb-10 flex items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    {editing ? (
                      <input
                        value={brief.businessName}
                        onChange={(e) =>
                          setBrief((p) => (p ? { ...p, businessName: e.target.value } : p))
                        }
                        autoFocus
                        className="w-full bg-transparent outline-none font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-none"
                      />
                    ) : (
                      <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-none">
                        {brief.businessName}
                      </h1>
                    )}
                    <p className="text-[13px] sm:text-[15px] text-foreground/35 mt-1.5 sm:mt-2">
                      {brief.tagline}
                    </p>
                    <p className="text-[11px] sm:text-[12px] text-muted-foreground/25 mt-1 font-mono tracking-wide">
                      {brief.subtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditing(!editing)}
                    className="shrink-0 mt-0.5 sm:mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 sm:px-3 py-1.5 rounded-lg border border-foreground/[0.08] text-muted-foreground/40 hover:text-foreground/60 hover:border-foreground/[0.12] transition-all cursor-pointer"
                  >
                    <PencilSimple className="size-3" weight={editing ? 'fill' : 'regular'} />
                    <span className="hidden sm:inline">{editing ? 'Done' : 'Edit'}</span>
                  </button>
                </div>

                {/* Body */}
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">
                  <div className="flex-1 min-w-0 order-2 lg:order-1">
                    {editing ? (
                      <textarea
                        value={brief.brief}
                        onChange={(e) => setBrief((p) => (p ? { ...p, brief: e.target.value } : p))}
                        rows={8}
                        className="w-full bg-transparent resize-y outline-none text-[14px] sm:text-[15px] text-foreground/55 leading-[1.85] sm:leading-[2] transition-colors focus:text-foreground/70 selection:bg-brand/10"
                      />
                    ) : (
                      <p className="text-[14px] sm:text-[15px] text-foreground/55 leading-[1.85] sm:leading-[2]">
                        {brief.brief}
                      </p>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="lg:w-64 shrink-0 space-y-5 sm:space-y-6 order-1 lg:order-2">
                    {brief.colors?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-foreground/30 uppercase tracking-[0.12em] mb-2.5 sm:mb-3">
                          Colors
                        </p>
                        <div className="flex gap-1.5 sm:gap-2">
                          {brief.colors.map((hex, i) => (
                            <div key={i} className="flex-1">
                              <div
                                className="aspect-square rounded-lg sm:rounded-xl ring-1 ring-black/[0.04]"
                                style={{ backgroundColor: hex }}
                              />
                              <p className="text-[8px] sm:text-[9px] font-mono text-muted-foreground/25 mt-1 sm:mt-1.5 text-center">
                                {hex}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {brief.uiStyle && (
                      <div>
                        <p className="text-[11px] font-medium text-foreground/30 uppercase tracking-[0.12em] mb-2.5 sm:mb-3">
                          UI Style
                        </p>
                        <p className="text-[11px] sm:text-[12px] text-foreground/40 leading-relaxed">
                          {brief.uiStyle}
                        </p>
                      </div>
                    )}
                    {brief.competitors?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-foreground/30 uppercase tracking-[0.12em] mb-2.5 sm:mb-3">
                          Competitors
                        </p>
                        {brief.competitors.map((c) => (
                          <a
                            key={c.name}
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 sm:gap-3 rounded-lg px-2 sm:px-2.5 py-2 -mx-1 hover:bg-foreground/[0.025] dark:hover:bg-white/[0.04] transition-colors group"
                          >
                            {host(c.url) && (
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${host(c.url)}&sz=32`}
                                alt=""
                                className="size-4 rounded shrink-0 opacity-40 group-hover:opacity-80 transition-opacity"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] sm:text-[13px] font-medium text-foreground/55 group-hover:text-foreground/75 truncate">
                                {c.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground/25 truncate">
                                {c.note}
                              </p>
                            </div>
                            <ArrowSquareOut className="size-3 text-muted-foreground/10 group-hover:text-muted-foreground/30 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-foreground/[0.04] flex justify-center">
                  <button
                    onClick={handleStart}
                    disabled={creating}
                    className="inline-flex items-center gap-2 sm:gap-2.5 h-11 sm:h-12 px-8 sm:px-10 rounded-full text-[13px] sm:text-sm font-semibold btn-brand cursor-pointer disabled:opacity-60"
                  >
                    {creating ? (
                      <>
                        <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Build my business
                        <ArrowRight className="size-4" weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-white dark:bg-background" />}>
      <Content />
    </Suspense>
  )
}
