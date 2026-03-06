'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import posthog from 'posthog-js'
import { authClient } from '@/lib/auth-client'
import { isWaitlistMode } from '@/lib/waitlist'

interface User {
  email: string
  name?: string
}

export function WaitlistScreen() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setUser(data.user as User)
    })
  }, [])

  const callbackURL =
    typeof window === 'undefined'
      ? undefined
      : new URL(isWaitlistMode() ? '/waitlist' : '/', window.location.origin).toString()

  const join = () => {
    if (!callbackURL) return
    setLoading(true)
    setError('')
    authClient.signIn.social({ provider: 'google', callbackURL }).catch(() => {
      setError('Failed to join waitlist')
      setLoading(false)
    })
  }

  const signOut = () => {
    setLoading(true)
    posthog.reset()
    authClient.signOut().finally(() => {
      setUser(null)
      setLoading(false)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background flex flex-col">
      <div className="flex-1 flex flex-col p-8 md:p-12 lg:p-20 max-w-3xl mx-auto w-full justify-between">
        {/* Top */}
        <div>
          <header className="mb-16 md:mb-24">
            <Link href="/" className="inline-block">
              <Image
                src="/surgent-logo-dark.svg"
                alt="Surgent"
                width={100}
                height={27}
                className="h-7 w-auto"
                priority
              />
            </Link>
          </header>

          <main>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="space-y-8"
            >
              <h1 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.1]">
                Build software without the headache.
              </h1>

              <p className="text-lg text-muted-foreground font-light max-w-md">
                Make money on the internet by building software — no code, no complexity.
              </p>

              {/* Action */}
              <div className="pt-2">
                {user ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-3 px-4 py-3 border border-border/50 bg-muted/30 rounded-lg">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm">
                        <span className="text-muted-foreground">Waitlisted as </span>
                        <span className="font-medium">{user.email}</span>
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={signOut}
                        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                        disabled={loading}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button
                      onClick={join}
                      disabled={loading}
                      className="h-12 px-6 text-base bg-brand text-brand-foreground hover:bg-brand/90 rounded-full transition-all"
                    >
                      {loading ? (
                        'Connecting...'
                      ) : (
                        <span className="flex items-center gap-2.5">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                              fill="#fff"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#fff"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#fff"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#fff"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          Sign in with Google
                        </span>
                      )}
                    </Button>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <p className="text-xs text-muted-foreground">
                      <Link href="/terms" className="underline hover:text-foreground">
                        Terms
                      </Link>
                      {' · '}
                      <Link href="/privacy" className="underline hover:text-foreground">
                        Privacy
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </main>
        </div>

        {/* Bottom */}
        <footer className="mt-20 space-y-10">
          {/* Integrations */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
              Integrations
            </p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8">
              <Image
                src="/Whop_logo.svg.png"
                alt="Whop"
                width={90}
                height={28}
                className="h-5 sm:h-6 md:h-7 w-auto object-contain opacity-50 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/convex-logo.svg"
                alt="Convex"
                width={120}
                height={32}
                className="h-6 sm:h-7 md:h-8 w-auto object-contain opacity-50 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/supabase-logo-wordmark--light.svg"
                alt="Supabase"
                width={140}
                height={32}
                className="h-5 sm:h-6 md:h-7 w-auto object-contain opacity-50 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/betterauth-logo.svg"
                alt="Better Auth"
                width={32}
                height={32}
                className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 object-contain opacity-50 hover:opacity-100 transition-opacity rounded"
              />
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Hiring
            </span>
            <a
              href="https://x.com/benroff_"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Twitter @benroff_
            </a>
            <a
              href="https://t.me/benrov"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Telegram @benrov
            </a>
          </div>

          {/* Copyright */}
          <div className="pt-6 text-xs text-muted-foreground/60">
            © Benrov, Inc. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  )
}
