import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'
import SignupContent from './signup-content'

export const metadata: Metadata = createPageMetadata({
  title: 'Sign Up',
  description:
    'Create your Surgent account and start building your AI-powered business in minutes.',
  path: '/signup',
  noIndex: true, // not blocked in robots.txt so Google can see this tag
})

type SearchParams = {
  next?: string
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { next } = await searchParams

  return <SignupContent next={next} />
}
