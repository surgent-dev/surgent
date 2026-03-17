'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { authClient } from '@/lib/auth-client'
import { isWaitlistMode } from '@/lib/waitlist'
import { WaitlistScreen } from '@/components/waitlist-screen'
import { useRouter } from 'next/navigation'
import { LandingNav } from '@/components/landing/nav'
import { LandingHero } from '@/components/landing/hero'
import { LandingFooter } from '@/components/landing/footer'

function IndexContent() {
  const waitlistMode = isWaitlistMode()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [promptValue, setPromptValue] = useState('')
  const router = useRouter()

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
      <LandingNav isLoggedIn={isLoggedIn} />

      <main className="relative z-10 flex-1 flex flex-col">
        <LandingHero
          promptValue={promptValue}
          onPromptChange={setPromptValue}
          onSend={handleSend}
        />
        {/* <LandingEarningProjects /> */}
        {/* <LandingHighlights /> */}
        {/* <LandingFeatures /> */}
      </main>

      <LandingFooter />
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
