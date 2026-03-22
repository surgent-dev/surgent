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

/* ── Rotating word ── */
const words = ['website', 'sales agent', 'marketing', 'customers']

function RotatingWord() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length)
        setVisible(true)
      }, 400)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className="inline-block transition-all duration-400 ease-in-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {words[index]}
    </span>
  )
}

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
    router.push(isLoggedIn ? '/project/new' : '/signup?next=/project/new')
  }, [isLoggedIn, router])

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* top */}
      <header className="shrink-0 px-6 sm:px-10 border-b border-border/30">
        <div className="flex items-center justify-between h-12 max-w-2xl w-full mx-auto">
          <Link href="/" className="text-foreground">
            <SurgentLogo className="text-base" />
          </Link>
          <Link
            href={isLoggedIn ? '/dashboard' : '/login'}
            className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {isLoggedIn ? 'Dashboard' : 'Log in'}
          </Link>
        </div>
      </header>

      {/* center */}
      <main className="flex-1 px-6 sm:px-10 overflow-auto">
        <div className="w-full max-w-2xl mx-auto pt-12 sm:pt-16 pb-12">
          <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] text-foreground mb-4">
            We build your{' '}
            <span className="text-foreground/30">
              <RotatingWord />
            </span>
          </h1>

          <p className="text-muted-foreground/50 text-sm max-w-[320px] leading-relaxed mb-6">
            Describe what you do. We create your site, deploy an AI sales agent, and bring you
            customers.
          </p>

          <button
            onClick={go}
            className="group inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors cursor-pointer mb-10"
          >
            Get started{' '}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground/40">
            {[
              {
                label: 'Website',
                icon: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <rect x="2" y="3" width="12" height="10" rx="1.5" />
                    <path d="M2 6h12" />
                  </svg>
                ),
              },
              {
                label: 'Sales Agent',
                icon: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M8 2L4.5 8h3L6 14l6-7H9l2-5H8z" />
                  </svg>
                ),
              },
              {
                label: 'Leads',
                icon: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M10.5 13.5v-1a3 3 0 00-3-3h-2a3 3 0 00-3 3v1" />
                    <circle cx="6.5" cy="5" r="2.5" />
                    <path d="M13 6v4m2-2h-4" />
                  </svg>
                ),
              },
              {
                label: 'Marketing',
                icon: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M13 3L6 6H3.5a.5.5 0 00-.5.5v3a.5.5 0 00.5.5H6l7 3V3z" />
                    <path d="M6 6v4" />
                  </svg>
                ),
              },
              {
                label: 'Payments',
                icon: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <rect x="2" y="4" width="12" height="8" rx="1.5" />
                    <path d="M2 7.5h12" />
                  </svg>
                ),
              },
            ].map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2.5 mt-8">
            <div className="flex -space-x-1">
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
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px] rounded-full border border-background object-cover"
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground/30">1,500+ businesses</span>
          </div>
        </div>
      </main>

      {/* bottom */}
      <footer className="shrink-0 px-6 sm:px-10 border-t border-border/30">
        <div className="flex items-center justify-between h-10 max-w-2xl w-full mx-auto text-[11px] text-muted-foreground/25">
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
