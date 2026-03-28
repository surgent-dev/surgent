'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { SurgentLogo } from '@/components/surgent-logo'

type SignupContentProps = {
  next?: string
  waitlistMode: boolean
}

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

export default function SignupContent({ next, waitlistMode }: SignupContentProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const redirectPath = waitlistMode ? '/waitlist' : next || '/'
  const callbackURL = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(redirectPath, process.env.NEXT_PUBLIC_APP_URL).toString()
    : undefined

  const handleGoogle = async () => {
    setIsLoading(true)
    setError('')
    try {
      await authClient.signIn.social({ provider: 'google', callbackURL })
    } catch {
      setError('Failed to continue with Google')
      setIsLoading(false)
    }
  }

  const handleEmail = async () => {
    if (!email.trim() || !password || !name.trim()) return
    setIsLoading(true)
    setError('')
    try {
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: redirectPath,
      })
      if (authError) {
        setError(authError.message || 'Something went wrong')
        setIsLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-white dark:bg-background text-foreground">
      <main className="flex-1 flex flex-col items-center px-6 pt-[22vh]">
        <div className="w-full max-w-xs">
          <div className="mb-10">
            <SurgentLogo className="text-lg" />
          </div>

          <h1 className="font-display text-xl text-foreground mb-1.5">
            {waitlistMode ? 'Join the waitlist' : 'Create your account'}
          </h1>
          <p className="text-xs text-muted-foreground/50 mb-6">
            Start building your website, sales agent, and more — in seconds.
          </p>

          {error && <p className="text-xs text-destructive mb-4">{error}</p>}

          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoFocus
              className="w-full h-10 px-3.5 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full h-10 px-3.5 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
              className="w-full h-10 px-3.5 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
            />
            <button
              onClick={handleEmail}
              disabled={isLoading || !email.trim() || !password || !name.trim()}
              className="btn-brand w-full h-10 rounded-[0.5rem] text-sm font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[11px] text-muted-foreground/30">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={isLoading}
              className="btn-brand-secondary w-full h-10 rounded-[0.5rem] flex items-center justify-center gap-2.5 text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <div className="mt-8 text-xs text-muted-foreground/40">
            Already have an account?{' '}
            <Link
              href={`/login${next ? `?next=${next}` : ''}`}
              className="text-brand hover:text-brand/80 transition-colors"
            >
              Log in
            </Link>
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground/25 leading-relaxed">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:text-muted-foreground/50 transition-colors">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:text-muted-foreground/50 transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
