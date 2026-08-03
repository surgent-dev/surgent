import { redirect } from 'next/navigation'

type SearchParams = {
  next?: string
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { next } = await searchParams
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
}
