'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
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
                },
                {
                  num: '02',
                  title: 'AI builds everything',
                  desc: 'Site, agent, lead capture, marketing — in minutes.',
                },
                {
                  num: '03',
                  title: 'Launch & grow',
                  desc: 'Go live instantly. AI brings you customers on autopilot.',
                },
              ].map((item) => (
                <div key={item.num}>
                  <span className="text-[11px] font-mono text-foreground/50">{item.num}</span>
                  <h3 className="text-sm font-medium text-foreground mt-2">{item.title}</h3>
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
