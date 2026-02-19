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
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200 landing-stagger-1"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid #e3e3e3' : '1px solid transparent',
      }}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 sm:px-8 h-14">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/surgent-logo.png"
            alt="Surgent"
            width={119}
            height={32}
            className="h-5 w-auto sm:h-6"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-2 text-[13px]">
          <Link
            href="/marketplace"
            className="text-[#616161] hover:text-[#303030] transition-colors px-3 py-1.5"
            style={{ fontWeight: 450 }}
          >
            Marketplace
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-white px-3.5 py-1.5 rounded-lg transition-all duration-100 active:scale-[0.98] btn-elevated-primary"
              style={{
                fontWeight: 550,
                fontSize: '13px',
                background: '#303030',
              }}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[#616161] hover:text-[#303030] transition-colors px-3 py-1.5"
                style={{ fontWeight: 450 }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-white px-3.5 py-1.5 rounded-lg transition-all duration-100 active:scale-[0.98] btn-elevated-primary"
                style={{
                  fontWeight: 550,
                  fontSize: '13px',
                  background: '#303030',
                }}
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden text-[#616161] hover:text-[#303030] transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="sm:hidden"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid #e3e3e3',
          }}
        >
          <nav className="flex flex-col px-6 py-4 gap-3 text-sm" style={{ fontWeight: 450 }}>
            <Link
              href="/marketplace"
              className="text-[#616161] hover:text-[#303030] transition-colors py-2"
            >
              Marketplace
            </Link>
            <div
              className="pt-3 mt-1 flex flex-col gap-2"
              style={{ borderTop: '1px solid #e3e3e3' }}
            >
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="text-white px-4 py-2 text-sm text-center rounded-lg btn-elevated-primary"
                  style={{ fontWeight: 550, background: '#303030' }}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-[#616161] hover:text-[#303030] transition-colors py-2"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="text-white px-4 py-2 text-sm text-center rounded-lg btn-elevated-primary"
                    style={{ fontWeight: 550, background: '#303030' }}
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
