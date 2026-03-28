'use client'

import Link from 'next/link'
import { SurgentLogo } from '@/components/surgent-logo'

export function LandingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-8 landing-stagger-1">
      <div className="mx-auto max-w-6xl w-full flex items-center justify-between h-14">
        <Link href="/" className="flex items-center text-foreground">
          <SurgentLogo className="text-lg" />
        </Link>

        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Dashboard &rarr;
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Sign in &rarr;
          </Link>
        )}
      </div>
    </header>
  )
}
