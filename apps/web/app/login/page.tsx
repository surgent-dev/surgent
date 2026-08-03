import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'
import LoginContent from './login-content'

export const metadata: Metadata = createPageMetadata({
  title: 'Log In',
  description: 'Log in to your Surgent account to manage your AI-built business.',
  path: '/login',
  noIndex: true, // not blocked in robots.txt so Google can see this tag
})

type SearchParams = {
  next?: string
  error?: string
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { next, error } = await searchParams

  return <LoginContent next={next} authError={error} />
}
