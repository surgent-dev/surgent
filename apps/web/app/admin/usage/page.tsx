import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { serverBackendUrl } from '@/lib/server-backend'
import { UsageDashboard, type UsageData } from './usage-dashboard'

interface SearchParams {
  range?: string
}

async function fetchUsageData(
  params: SearchParams,
): Promise<{ data: UsageData | null; error?: string }> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  const range = params.range || 'month'
  const url = `${serverBackendUrl}/api/admin/usage?range=${range}`

  const res = await fetch(url, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 403) return { data: null, error: 'Access denied' }
  if (!res.ok) return { data: null, error: 'Failed to load usage data' }

  return { data: await res.json() }
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { data, error } = await fetchUsageData(params)

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{error || 'Failed to load usage data'}</p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}
    >
      <UsageDashboard data={data} />
    </Suspense>
  )
}
