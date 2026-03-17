import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AdminDashboard } from './admin-dashboard'
import type { AdminOverview } from './types'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface AdminFetchError {
  error: string
  email?: string | null
}

interface SearchParams {
  range?: string
  page?: string
  perPage?: string
  sort?: string
  deployed?: string
}

async function fetchAdminData(
  params: SearchParams,
): Promise<{ data: AdminOverview | null; error?: AdminFetchError }> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  const range = params.range || 'today'
  const page = params.page || '1'
  const perPage = params.perPage || '25'
  const sort = params.sort || 'desc'
  const qp = new URLSearchParams({ range, page, perPage, sort })
  if (params.deployed) qp.set('deployed', params.deployed)
  const url = `${BACKEND_URL}/api/admin/overview?${qp.toString()}`

  const res = await fetch(url, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  })

  if (res.status === 401) redirect('/login')
  if (res.status === 403) {
    return { data: null, error: await res.json() }
  }
  if (!res.ok) return { data: null, error: { error: 'Failed to load admin data' } }

  return { data: await res.json() }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const { data, error } = await fetchAdminData(params)

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground">{error?.error || 'Failed to load admin data'}</p>
          {error?.email ? (
            <p className="text-xs text-muted-foreground">Signed in as {error.email}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Suspense
      fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}
    >
      <AdminDashboard data={data} />
    </Suspense>
  )
}
