'use client'

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FolderKanban,
  Layers,
  Receipt,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminRangeSelect } from '@/components/admin/admin-range-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateShort } from '@/lib/format'
import type { AdminOverview, AdminTransactions } from './types'

function formatChartTick(value: string) {
  if (value.length === 7) return value
  if (value.length >= 10) return value.slice(5)
  return value
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string
  value: string
  icon: React.ElementType
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}

function SignupsChart({
  data,
  total,
}: {
  data: Array<{ date: string; count: string }>
  total: string
}) {
  const chartData = data.map((d) => ({ date: d.date, count: Number(d.count) }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">User Signups</CardTitle>
        <span className="text-xs text-muted-foreground">{total} in range</span>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ count: { label: 'Signups', color: 'hsl(var(--chart-1))' } }}
          className="h-[250px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="signupsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatChartTick}
                className="text-xs"
              />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <Tooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--chart-1))"
                fill="url(#signupsGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function ProjectsChart({
  data,
  total,
}: {
  data: Array<{ date: string; count: string }>
  total: string
}) {
  const chartData = data.map((d) => ({ date: d.date, count: Number(d.count) }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Projects Created</CardTitle>
        <span className="text-xs text-muted-foreground">{total} in range</span>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ count: { label: 'Projects', color: 'hsl(var(--chart-2))' } }}
          className="h-[250px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="projectsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatChartTick}
                className="text-xs"
              />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <Tooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--chart-2))"
                fill="url(#projectsGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function formatCents(cents: number): string {
  const val = cents / 100
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  if (val >= 1) return `$${val.toFixed(2)}`
  if (val > 0) return `$${val.toFixed(2)}`
  return '$0'
}

function TransactionsChart({
  data,
  totals,
}: {
  data: AdminTransactions['chart']
  totals: AdminTransactions['totals']
}) {
  const chartData = data.map((d) => ({
    date: d.date,
    revenue: Number(d.revenue) / 100,
    transactions: Number(d.transactions),
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Transactions & Revenue</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{formatCents(Number(totals.grossRevenue))} gross</span>
          <span>{Number(totals.transactionCount)} payments</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 mb-6">
          <div>
            <p className="text-xs text-muted-foreground">Gross Revenue</p>
            <p className="text-lg font-semibold">{formatCents(Number(totals.grossRevenue))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net Revenue</p>
            <p className="text-lg font-semibold">{formatCents(Number(totals.netRevenue))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Refunds</p>
            <p className="text-lg font-semibold">{formatCents(Number(totals.totalRefunds))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fees</p>
            <p className="text-lg font-semibold">{formatCents(Number(totals.totalFees))}</p>
          </div>
        </div>
        <ChartContainer
          config={{
            revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
            transactions: { label: 'Transactions', color: 'hsl(var(--chart-3))' },
          }}
          className="h-[250px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="txRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatChartTick}
                className="text-xs"
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickFormatter={(v) => `$${v}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltipContent />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-1))"
                fill="url(#txRevenueGradient)"
                strokeWidth={2}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="transactions"
                stroke="hsl(var(--chart-3))"
                fill="none"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex items-center gap-4 mt-2 justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-[hsl(var(--chart-1))]" />
            Revenue
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-0.5 w-2.5 bg-[hsl(var(--chart-3))]"
              style={{ borderTop: '2px dashed hsl(var(--chart-3))' }}
            />
            Transactions
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Last10UsersTable({
  users,
}: {
  users: Array<{
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
  }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Last 10 Signups</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Signed Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name || '—'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                    {user.emailVerified ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateShort(user.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No users in this range
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function Pagination({
  page,
  perPage,
  total,
  type,
}: {
  page: number
  perPage: number
  total: number
  type: 'users' | 'projects'
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const outOfRange = total === 0 || page > totalPages

  function goTo(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/admin?${params.toString()}`)
  }

  const start = outOfRange ? 0 : (page - 1) * perPage + 1
  const end = outOfRange ? 0 : Math.min(page * perPage, total)

  return (
    <div className="flex items-center justify-between py-4">
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {total} {type}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => goTo(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SortToggle({ currentSort }: { currentSort: 'asc' | 'desc' }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', currentSort === 'desc' ? 'asc' : 'desc')
    params.set('page', '1')
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={toggle}>
      <ArrowUpDown className="h-3 w-3" />
      {currentSort === 'desc' ? 'Newest' : 'Oldest'}
    </Button>
  )
}

function AllUsersTable({
  users,
  pagination,
}: {
  users: Array<{
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
  }>
  pagination: AdminOverview['pagination']
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {pagination.totalUsers} users in selected range
        </p>
        <SortToggle currentSort={pagination.sort} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Signed Up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name || '—'}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                  {user.emailVerified ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateShort(user.createdAt)}
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No users in this range
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.totalUsers}
        type="users"
      />
    </div>
  )
}

function AllProjectsTable({
  projects,
  pagination,
}: {
  projects: AdminOverview['allProjects']
  pagination: AdminOverview['pagination']
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deployed = searchParams.get('deployed') === 'true'
  const filterValue = deployed ? 'deployed' : 'all'
  const listLabel = deployed ? 'deployed projects' : 'projects'
  const emptyLabel = deployed ? 'No deployments in this range' : 'No projects in this range'

  function onFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    const next = value === 'deployed'
    if (next) params.set('deployed', 'true')
    if (!next) params.delete('deployed')
    params.set('page', '1')
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {pagination.totalProjects} {listLabel} in selected range
        </p>
        <div className="flex items-center gap-2">
          <Select value={filterValue} onValueChange={onFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="deployed">Deployed only</SelectItem>
            </SelectContent>
          </Select>
          <SortToggle currentSort={pagination.sort} />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Deployment</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.name || 'Untitled'}</TableCell>
              <TableCell>{project.userEmail}</TableCell>
              <TableCell>
                {project.worker ? (
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant={
                        project.worker.status === 'error'
                          ? 'destructive'
                          : project.worker.status === 'active'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {project.worker.status ?? 'inactive'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{project.worker.name}</span>
                    <span className="text-xs text-muted-foreground">
                      by {project.userName || project.userEmail}
                    </span>
                    {project.worker.hostname ? (
                      <a
                        className="text-xs text-muted-foreground underline underline-offset-2"
                        href={project.worker.hostname}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {project.worker.hostname}
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateShort(project.createdAt)}
              </TableCell>
            </TableRow>
          ))}
          {projects.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.totalProjects}
        type="projects"
      />
    </div>
  )
}

export function AdminDashboard({
  data,
  transactions,
}: {
  data: AdminOverview
  transactions: AdminTransactions | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'users'

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    params.set('page', '1')
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/usage">Usage</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/ops">Ops</Link>
            </Button>
            <AdminRangeSelect />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Users" value={data.totals.users} icon={Users} />
          <StatCard title="Users in Range" value={data.totals.usersInRange} icon={UserPlus} />
          <StatCard title="Total Projects" value={data.totals.projects} icon={FolderKanban} />
          <StatCard title="Projects in Range" value={data.totals.projectsInRange} icon={Layers} />
          {transactions && (
            <>
              <StatCard
                title="Gross Revenue"
                value={formatCents(Number(transactions.totals.grossRevenue))}
                icon={DollarSign}
              />
              <StatCard
                title="Net Revenue"
                value={formatCents(Number(transactions.totals.netRevenue))}
                icon={DollarSign}
              />
              <StatCard
                title="Payments"
                value={Number(transactions.totals.transactionCount).toLocaleString()}
                icon={Receipt}
              />
              <StatCard
                title="Total Events"
                value={Number(transactions.totals.totalEvents).toLocaleString()}
                icon={Receipt}
              />
            </>
          )}
        </div>

        {transactions && (
          <TransactionsChart data={transactions.chart} totals={transactions.totals} />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <SignupsChart data={data.charts.users} total={data.totals.usersInRange} />
          <ProjectsChart data={data.charts.projects} total={data.totals.projectsInRange} />
        </div>

        <Last10UsersTable users={data.last10Users} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={onTabChange}>
              <TabsList>
                <TabsTrigger value="users">Users ({data.pagination.totalUsers})</TabsTrigger>
                <TabsTrigger value="projects">
                  Projects ({data.pagination.totalProjects})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="users" className="mt-4">
                <AllUsersTable users={data.allUsers} pagination={data.pagination} />
              </TabsContent>
              <TabsContent value="projects" className="mt-4">
                <AllProjectsTable projects={data.allProjects} pagination={data.pagination} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
