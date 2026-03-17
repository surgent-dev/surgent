export interface AdminOverview {
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
