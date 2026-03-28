'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { isWaitlistMode } from '@/lib/waitlist'
import { WaitlistScreen } from '@/components/waitlist-screen'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { SurgentLogo } from '@/components/surgent-logo'

function IndexContent() {
  const waitlistMode = isWaitlistMode()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    authClient.getSession().then(({ data }) => setIsLoggedIn(!!data?.user))
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    const error = url.searchParams.get('error')
    if (error) {
      url.searchParams.delete('error')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      toast.error(error)
    }
  }, [])

  if (waitlistMode) return <WaitlistScreen />

  const go = useCallback(() => {
    router.push('/get-started')
  }, [router])

  return (
    <div className="min-h-dvh flex flex-col bg-white dark:bg-background text-foreground">
      {/* top */}
      <header className="shrink-0 px-6 sm:px-10">
        <div className="flex items-center justify-between h-14 max-w-2xl w-full mx-auto">
          <Link href="/" className="text-foreground">
            <SurgentLogo className="text-[17px]" />
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              {isLoggedIn ? 'Dashboard' : 'Log in'}
            </Link>
            {!isLoggedIn && (
              <button
                onClick={go}
                className="btn-brand-secondary inline-flex items-center h-7 px-3.5 rounded-md text-xs font-medium cursor-pointer"
              >
                Get started
              </button>
            )}
          </div>
        </div>
      </header>

      {/* center */}
      <main className="flex-1 px-6 sm:px-10 overflow-auto">
        <div className="w-full max-w-2xl mx-auto pt-20 sm:pt-28 pb-12">
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight text-foreground mb-5">
            We build and grow
            <br />
            your business.
          </h1>

          <p className="text-muted-foreground/50 text-[15px] max-w-[340px] leading-relaxed mb-8">
            Describe what you do. We create your site, deploy an AI sales agent, and bring you
            customers.
          </p>

          <button
            onClick={go}
            className="btn-brand-secondary inline-flex items-center gap-2 h-10 px-6 rounded-[0.5rem] text-sm font-medium cursor-pointer mb-6"
          >
            Start building
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-1.5">
              {[
                { src: '/lovedby/alidar.png', alt: 'Alidar' },
                { src: '/lovedby/asadbek.jpeg', alt: 'Asadbek' },
                { src: '/lovedby/diyor.jpeg', alt: 'Diyor' },
                { src: '/lovedby/sardor.jpeg', alt: 'Sardor' },
              ].map((a) => (
                <Image
                  key={a.alt}
                  src={a.src}
                  alt={a.alt}
                  width={22}
                  height={22}
                  className="w-[22px] h-[22px] rounded-full border-[1.5px] border-white dark:border-background object-cover"
                />
              ))}
            </div>
            <span className="text-[12px] text-muted-foreground/40">
              Trusted by 1,500+ businesses
            </span>
          </div>

          {/* How it works */}
          <div className="mt-24 sm:mt-32">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/30 mb-8">
              How it works
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-5">
              {[
                {
                  num: '01',
                  title: 'Describe your business',
                  desc: 'What you do, who you serve. A few sentences is enough.',
                  icon: (
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
                      <path d="M3 5.5C3 3.567 4.567 2 6.5 2h11C19.433 2 21 3.567 21 5.5v8c0 1.933-1.567 3.5-3.5 3.5H11l-4.4 3.52a.75.75 0 01-1.2-.6V17c-1.4-.5-2.4-1.8-2.4-3.5v-8z" />
                    </svg>
                  ),
                },
                {
                  num: '02',
                  title: 'AI builds everything',
                  desc: 'Site, agent, lead capture, marketing — in minutes.',
                  icon: (
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
                      <path d="M11.48 2.3a.75.75 0 011.04 0l2.83 2.72a.75.75 0 01-.52 1.28h-1.08v4.45h4.45V9.67a.75.75 0 011.28-.52l2.72 2.83a.75.75 0 010 1.04l-2.72 2.83a.75.75 0 01-1.28-.52v-1.08h-4.45v4.45h1.08a.75.75 0 01.52 1.28l-2.83 2.72a.75.75 0 01-1.04 0l-2.83-2.72a.75.75 0 01.52-1.28h1.08v-4.45H5.8v1.08a.75.75 0 01-1.28.52L1.8 13.02a.75.75 0 010-1.04l2.72-2.83a.75.75 0 011.28.52v1.08h4.45V6.3H9.17a.75.75 0 01-.52-1.28L11.48 2.3z" />
                    </svg>
                  ),
                },
                {
                  num: '03',
                  title: 'Launch & grow',
                  desc: 'Go live instantly. AI brings you customers on autopilot.',
                  icon: (
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
                      <path d="M13.25 2.16a1.75 1.75 0 00-2.5 0C8.56 4.44 7 7.87 7 11c0 1.15.2 2.24.56 3.22L5.3 16.47a1.75 1.75 0 00-.3.98V20a1.75 1.75 0 001.75 1.75h2.5V18.5a2.75 2.75 0 015.5 0v3.25h2.5A1.75 1.75 0 0019 20v-2.55c0-.35-.1-.7-.3-.98l-2.26-2.25c.36-.98.56-2.07.56-3.22 0-3.13-1.56-6.56-3.75-8.84z" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div key={item.num}>
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center text-foreground/40">
                      {item.icon}
                    </div>
                    <span className="text-[11px] font-mono text-foreground/50">{item.num}</span>
                  </div>
                  <h3 className="text-sm font-medium text-foreground mt-3">{item.title}</h3>
                  <p className="text-[13px] text-muted-foreground/40 leading-relaxed mt-1">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Closing CTA */}
          <div className="mt-24 sm:mt-32 mb-12 text-center">
            <h2 className="font-display text-3xl sm:text-4xl leading-[1.05] text-foreground mb-3">
              Start building today.
            </h2>
            <p className="text-sm text-muted-foreground/40 mb-7">
              Describe your business. We handle the rest.
            </p>
            <button
              onClick={go}
              className="btn-brand inline-flex items-center gap-2 h-10 px-7 rounded-[0.5rem] text-sm font-medium cursor-pointer"
            >
              Create your business
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <p className="text-[11px] text-muted-foreground/25 mt-4">No credit card required</p>
          </div>
        </div>
      </main>

      {/* bottom */}
      <footer className="shrink-0 px-6 sm:px-10">
        <div className="flex items-center justify-between h-12 max-w-2xl w-full mx-auto text-[11px] text-muted-foreground/25">
          <span>&copy; {new Date().getFullYear()} Benrov</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-muted-foreground/50 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-muted-foreground/50 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
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
