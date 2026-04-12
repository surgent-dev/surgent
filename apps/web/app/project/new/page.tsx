'use client'

import { motion } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { track } from '@/lib/track'
import { useCreateProject } from '@/queries/projects'

const GH_URL = 'https://github.com/bahodirr/worker-vite-react-simple-template'

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

/* ─── Main ─── */

function Content() {
  const router = useRouter()
  const prompt = useSearchParams().get('prompt') || ''
  const create = useCreateProject()
  const started = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!prompt) {
      router.replace('/')
      return
    }
    const data = readOnboarding()

    create
      .mutateAsync({
        name: data?.businessName || 'My Project',
        githubUrl: GH_URL,
        initConvex: false,
        metadata: data ? { onboarding: { ...data, prompt } } : undefined,
      })
      .then(({ id }) => {
        track('project_created', { project_id: id })
        router.replace(`/company/${id}/editor?initial=${encodeURIComponent(prompt)}`)
      })
      .catch((err: any) => {
        setError(err?.message || 'Something went wrong. Please try again.')
      })
  }, [prompt, router, create])

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-white dark:bg-background">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm px-4">
          <p className="text-sm text-foreground/70">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 text-[13px] text-brand hover:underline cursor-pointer"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-white dark:bg-background">
      <div className="absolute top-0 left-0 right-0 h-1 bg-foreground/[0.04]">
        <motion.div
          className="h-full rounded-r-full bg-brand shadow-[0_0_8px_rgba(124,92,252,0.4)]"
          initial={{ width: '0%' }}
          animate={{ width: '60%' }}
          transition={{ duration: 12, ease: 'linear' }}
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="size-8 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
        <p className="text-sm text-muted-foreground/50">Setting up your project...</p>
      </div>
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
