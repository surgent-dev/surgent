'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SurgentLogo } from '@/components/surgent-logo'
import { authClient } from '@/lib/auth-client'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!password || !confirmPassword) return
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (authError) {
        setError(authError.message || 'Something went wrong')
        setIsLoading(false)
      } else {
        setSuccess(true)
        setIsLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-dvh flex flex-col bg-white dark:bg-background text-foreground">
        <main className="flex-1 flex flex-col items-center px-6 pt-[22vh]">
          <div className="w-full max-w-xs">
            <div className="mb-10">
              <SurgentLogo className="text-lg" />
            </div>
            <h1 className="font-display text-xl text-foreground mb-1.5">Invalid reset link</h1>
            <p className="text-xs text-muted-foreground/50 mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="text-xs text-brand hover:text-brand/80 transition-colors"
            >
              Request a new reset link
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-white dark:bg-background text-foreground">
      <main className="flex-1 flex flex-col items-center px-6 pt-[22vh]">
        <div className="w-full max-w-xs">
          <div className="mb-10">
            <SurgentLogo className="text-lg" />
          </div>

          {success ? (
            <>
              <h1 className="font-display text-xl text-foreground mb-1.5">Password reset</h1>
              <p className="text-xs text-muted-foreground/50 mb-6">
                Your password has been reset successfully.
              </p>
              <Link
                href="/login"
                className="btn-brand inline-block h-10 leading-10 px-6 rounded-[0.5rem] text-sm font-medium text-center"
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl text-foreground mb-1.5">Set new password</h1>
              <p className="text-xs text-muted-foreground/50 mb-6">
                Enter your new password below.
              </p>

              {error && <p className="text-xs text-destructive mb-4">{error}</p>}

              <div className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoFocus
                  className="w-full h-10 px-3.5 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-10 px-3.5 rounded-lg border border-border bg-muted/70 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 transition-colors"
                />
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !password || !confirmPassword}
                  className="btn-brand w-full h-10 rounded-[0.5rem] text-sm font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting...' : 'Reset password'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
