'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

export function LandingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 landing-stagger-1 px-6 ${scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-border' : 'border-b border-transparent'}`}
    >
      <div className="mx-auto max-w-6xl w-full flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/surgent-logo-dark.svg"
            alt="Surgent"
            width={119}
            height={32}
            className="h-7 w-auto hidden dark:block"
            priority
          />
          <Image
            src="/surgent-logo.svg"
            alt="Surgent"
            width={119}
            height={32}
            className="h-7 w-auto block dark:hidden"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-2 text-[13px]">
          <Link
            href="/inspirations"
            className="text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 font-[450]"
          >
            Inspirations
          </Link>
          <Link
            href="/marketplace"
            className="text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 font-[450]"
          >
            Marketplace
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-lg transition-all duration-100 active:scale-[0.98] font-[550] text-[13px] bg-muted text-foreground border border-border"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 font-[450]"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 rounded-lg transition-all duration-100 active:scale-[0.98] font-[550] text-[13px] bg-foreground text-background"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden text-muted-foreground hover:text-foreground transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="sm:hidden bg-background/95 backdrop-blur-xl border-t border-border">
          <nav className="flex flex-col px-6 py-4 gap-3 text-sm font-[450]">
            <Link
              href="/inspirations"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Inspirations
            </Link>
            <Link
              href="/marketplace"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Marketplace
            </Link>
            <div className="pt-3 mt-1 flex flex-col gap-2 border-t border-border">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm text-center rounded-lg font-[550] bg-muted text-foreground border border-border"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 text-sm text-center rounded-lg font-[550] bg-foreground text-background"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
