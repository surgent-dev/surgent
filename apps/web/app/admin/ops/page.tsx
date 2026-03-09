import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { OpsDashboard } from './ops-dashboard'
import type { AdminOpsData } from './types'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface AdminOpsFetchError {
  error: string
  email?: string | null
}

interface SearchParams {
  range?: string
}

async function fetchAdminOps(
  params: SearchParams,
): Promise<{ data: AdminOpsData | null; error?: AdminOpsFetchError }> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  const qp = new URLSearchParams({ range: params.range || 'today' })
  const res = await fetch(`${BACKEND_URL}/api/admin/ops?${qp.toString()}`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 403) {
    return { data: null, error: await res.json() }
  }
  if (!res.ok) return { data: null, error: { error: 'Failed to load admin ops data' } }

  return { data: await res.json() }
}

export default async function AdminOpsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { data, error } = await fetchAdminOps(params)

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground">{error?.error || 'Failed to load admin ops data'}</p>
          {error?.email ? (
            <p className="text-xs text-muted-foreground">Signed in as {error.email}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return <OpsDashboard data={data} />
}
