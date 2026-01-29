import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AdminDashboard } from './admin-dashboard'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface AdminOverview {
  range: string
  start: string
  pagination: {
    page: number
    perPage: number
    sort: 'asc' | 'desc'
    totalUsers: number
    totalProjects: number
  }
  totals: {
    users: string
    projects: string
    usersInRange: string
    projectsInRange: string
  }
  last10Users: Array<{
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
  }>
  allUsers: Array<{
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
  }>
  allProjects: Array<{
    id: string
    name: string
    userId: string
    createdAt: string
    userName: string | null
    userEmail: string
    worker: { name: string; status: string | null; hostname: string | null } | null
  }>
  charts: {
    users: Array<{ date: string; count: string }>
    projects: Array<{ date: string; count: string }>
  }
}

interface SearchParams {
  range?: string
  page?: string
  perPage?: string
  sort?: string
  deployed?: string
}

async function fetchAdminData(params: SearchParams): Promise<AdminOverview | null> {
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
  if (res.status === 403) redirect('/')
  if (!res.ok) return null

  return res.json()
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const data = await fetchAdminData(params)

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Failed to load admin data</p>
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
