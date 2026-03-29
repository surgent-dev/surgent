import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { isWaitlistMode } from './lib/waitlist'
import {
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_COOKIE_NAME,
  getReferralCookieDomain,
  isUuid,
} from './lib/referrals'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const ref = request.nextUrl.searchParams.get('ref')?.trim()

  if (ref && isUuid(ref)) {
    const url = request.nextUrl.clone()
    const domain = getReferralCookieDomain(request.nextUrl.hostname)
    url.searchParams.delete('ref')

    const response = NextResponse.redirect(url)
    response.cookies.set({
      name: REFERRAL_COOKIE_NAME,
      value: ref,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      ...(domain ? { domain } : {}),
    })
    return response
  }

  if (isWaitlistMode()) {
    if (path.startsWith('/dashboard') || path.startsWith('/project')) {
      return NextResponse.redirect(new URL('/waitlist', request.url))
    }
  }

  // Routes that require authentication
  const isProtectedRoute =
    path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/project')

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  const sessionCookie = getSessionCookie(request)

  // Redirect unauthenticated users to login, preserving return URL
  if (!sessionCookie) {
    const returnTo = request.nextUrl.pathname + request.nextUrl.search
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', returnTo)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
