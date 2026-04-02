'use client'

import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Hash,
  TrendingUp,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminRangeSelect } from '@/components/admin/admin-range-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MONEY_SCALE = 100_000_000

function formatUsd(micros: string | number) {
  const val = Number(micros) / MONEY_SCALE
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  if (val >= 1) return `$${val.toFixed(2)}`
  if (val > 0) return `$${val.toFixed(4)}`
  return '$0.00'
}

function formatNumber(n: string | number) {
  return Number(n).toLocaleString()
}

function formatTokens(n: string | number) {
  const val = Number(n)
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`
  return String(val)
}

function formatChartTick(value: string) {
  if (value.length === 7) return value.slice(2)
  if (value.length >= 10) return value.slice(5)
  return value
}

interface ChartPoint {
  date: string
  revenue: string
  providerCost: string
  requests: string
}

interface ActivePoint {
  date: string
  count: string
}

interface TopUser {
  userId: string
  userName: string | null
  userEmail: string
  requestCount: string
  totalSpend: string
  projectCount: string
  projects: Array<{
    projectId: string
    projectName: string
    requests: string
    spend: string
  }>
}

interface ModelRow {
  model: string
  provider: string
  requests: string
  billedCost: string
  providerCost: string
  inputTokens: string
  outputTokens: string
}

export interface UsageData {
  range: string
  start: string
  overview: {
    totalRevenueMicros: string
    totalProviderCostMicros: string
    marginMicros: string
    marginPercent: string
    activeUsers: string
    totalRequests: string
  }
  revenueChart: ChartPoint[]
  activeUsersChart: ActivePoint[]
  topUsers: TopUser[]
  modelUsage: ModelRow[]
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

const revenueChartConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  providerCost: { label: 'Provider Cost', color: 'var(--chart-2)' },
}

const activeChartConfig = {
  count: { label: 'Active Users', color: 'var(--chart-3)' },
}

function RevenueChart({ data }: { data: ChartPoint[] }) {
  const mapped = data.map((d) => ({
    date: d.date,
    revenue: Number(d.revenue) / MONEY_SCALE,
    providerCost: Number(d.providerCost) / MONEY_SCALE,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Revenue vs Provider Cost</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueChartConfig} className="h-[250px] w-full">
          <AreaChart data={mapped}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatChartTick} fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--chart-1)"
              fill="url(#revGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="providerCost"
              stroke="var(--chart-2)"
              fill="url(#costGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function ActiveUsersChart({ data }: { data: ActivePoint[] }) {
  const mapped = data.map((d) => ({ date: d.date, count: Number(d.count) }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={activeChartConfig} className="h-[250px] w-full">
          <AreaChart data={mapped}>
            <defs>
              <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatChartTick} fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--chart-3)"
              fill="url(#activeGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function TopUsersTable({ users }: { users: TopUser[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>User</TableHead>
          <TableHead className="text-right">Projects</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Spend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u, i) => (
          <>
            <TableRow
              key={u.userId}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => toggle(u.userId)}
            >
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {expanded.has(u.userId) ? (
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium text-sm">{u.userName || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{u.userEmail}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">{formatNumber(u.projectCount)}</TableCell>
              <TableCell className="text-right">{formatNumber(u.requestCount)}</TableCell>
              <TableCell className="text-right font-medium">{formatUsd(u.totalSpend)}</TableCell>
            </TableRow>
            {expanded.has(u.userId) &&
              u.projects.map((p) => (
                <TableRow key={`${u.userId}-${p.projectId}`} className="bg-muted/30">
                  <TableCell />
                  <TableCell className="pl-12 text-sm text-muted-foreground">
                    {p.projectName || p.projectId.slice(0, 8)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatNumber(p.requests)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatUsd(p.spend)}
                  </TableCell>
                </TableRow>
              ))}
          </>
        ))}
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No usage data in this period
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function ModelUsageTable({ models }: { models: ModelRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Margin</TableHead>
          <TableHead className="text-right">Tokens</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((m) => {
          const rev = Number(m.billedCost)
          const cost = Number(m.providerCost)
          const margin = rev > 0 ? (((rev - cost) / rev) * 100).toFixed(0) : '0'
          return (
            <TableRow key={`${m.model}-${m.provider}`}>
              <TableCell className="font-medium text-sm">{m.model}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {m.provider}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{formatNumber(m.requests)}</TableCell>
              <TableCell className="text-right">{formatUsd(m.billedCost)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatUsd(m.providerCost)}
              </TableCell>
              <TableCell className="text-right">{margin}%</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatTokens(Number(m.inputTokens) + Number(m.outputTokens))}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function UsageDashboard({ data }: { data: UsageData }) {
  const { overview } = data

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">Usage Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">Overview</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/ops">Ops</Link>
            </Button>
            <AdminRangeSelect basePath="/admin/usage" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Revenue"
            value={formatUsd(overview.totalRevenueMicros)}
            icon={DollarSign}
          />
          <StatCard
            title="Provider Cost"
            value={formatUsd(overview.totalProviderCostMicros)}
            icon={TrendingUp}
          />
          <StatCard
            title="Margin"
            value={`${formatUsd(overview.marginMicros)} (${overview.marginPercent}%)`}
            icon={Activity}
          />
          <StatCard title="Active Users" value={formatNumber(overview.activeUsers)} icon={Users} />
          <StatCard
            title="Total Requests"
            value={formatNumber(overview.totalRequests)}
            icon={Hash}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart data={data.revenueChart} />
          <ActiveUsersChart data={data.activeUsersChart} />
        </div>

        <Card>
          <Tabs defaultValue="users">
            <CardHeader className="pb-0">
              <TabsList>
                <TabsTrigger value="users">Top Users</TabsTrigger>
                <TabsTrigger value="models">Model Usage</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-4">
              <TabsContent value="users" className="mt-0">
                <TopUsersTable users={data.topUsers} />
              </TabsContent>
              <TabsContent value="models" className="mt-0">
                <ModelUsageTable models={data.modelUsage} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
