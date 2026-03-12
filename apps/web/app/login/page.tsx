import LoginContent from './login-content'
import { isWaitlistMode } from '@/lib/waitlist'

type SearchParams = {
  next?: string
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { next } = await searchParams

  return <LoginContent next={next} waitlistMode={isWaitlistMode()} />
}
