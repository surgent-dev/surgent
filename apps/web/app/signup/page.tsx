import SignupContent from './signup-content'
import { isWaitlistMode } from '@/lib/waitlist'

type SearchParams = {
  next?: string
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { next } = await searchParams

  return <SignupContent next={next} waitlistMode={isWaitlistMode()} />
}
