'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SurgentLogo } from '@/components/surgent-logo'
import { authClient } from '@/lib/auth-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setIsLoading(true)
    setError('')
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: '/reset-password',
      })
      if (authError) {
        setError(authError.message || 'Something went wrong')
        setIsLoading(false)
      } else {
        setSent(true)
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

          {sent ? (
            <>
              <h1 className="font-display text-xl text-foreground mb-1.5">Check your email</h1>
              <p className="text-xs text-muted-foreground/50 mb-6">
                If an account exists for <span className="text-foreground">{email}</span>, we sent a
                password reset link.
              </p>
              <Link
                href="/login"
                className="text-xs text-brand hover:text-brand/80 transition-colors"
              >
                Back to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl text-foreground mb-1.5">Reset your password</h1>
              <p className="text-xs text-muted-foreground/50 mb-6">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              {error && <p className="text-xs text-destructive mb-4">{error}</p>}

              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-10 px-3.5 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !email.trim()}
                  className="btn-brand w-full h-10 rounded-[0.5rem] text-sm font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </button>
              </div>

              <div className="mt-8 text-xs text-muted-foreground/40">
                Remember your password?{' '}
                <Link href="/login" className="text-brand hover:text-brand/80 transition-colors">
                  Log in
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
