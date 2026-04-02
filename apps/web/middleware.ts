import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { isWaitlistMode } from './lib/waitlist'
import {
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_COOKIE_NAME,
  getReferralCookieDomain,
  isUuid,
} from './lib/referrals'

const DUB_COOKIE_NAME = 'dub_id'
const DUB_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

function setDubCookie(response: NextResponse, dubId: string, request: NextRequest) {
  const cookieDomain = getReferralCookieDomain(request.nextUrl.hostname)
  response.cookies.set({
    name: DUB_COOKIE_NAME,
    value: dubId,
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: DUB_COOKIE_MAX_AGE,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const ref = request.nextUrl.searchParams.get('ref')?.trim()
  const dubId = request.nextUrl.searchParams.get(DUB_COOKIE_NAME)?.trim()

  let response = NextResponse.next()

  if (ref && isUuid(ref)) {
    const url = request.nextUrl.clone()
    const domain = getReferralCookieDomain(request.nextUrl.hostname)
    url.searchParams.delete('ref')

    response = NextResponse.redirect(url)
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
  }

  if (dubId) setDubCookie(response, dubId, request)

  if (ref && isUuid(ref)) {
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
    return response
  }

  const sessionCookie = getSessionCookie(request)

  // Redirect unauthenticated users to login, preserving return URL
  if (!sessionCookie) {
    const returnTo = request.nextUrl.pathname + request.nextUrl.search
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', returnTo)
    const loginResponse = NextResponse.redirect(loginUrl)
    if (dubId) setDubCookie(loginResponse, dubId, request)
    return loginResponse
  }

  return response
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
