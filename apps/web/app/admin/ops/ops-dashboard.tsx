'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react'
import { AdminRangeSelect } from '@/components/admin/admin-range-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateShort, timeAgoDetailed } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  AdminOpsAlert,
  AdminOpsData,
  AdminOpsDeploymentActiveItem,
  AdminOpsDeploymentFailureItem,
  AdminOpsJobItem,
  AdminOpsJobsResponse,
  AdminOpsJobState,
  AdminOpsProjectItem,
  AdminOpsQueueItem,
} from './types'

const JOBS_PER_PAGE = 20

// ── Helpers ───────────────────────────────────────────────────────────

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return '—'
  return JSON.stringify(value, null, 2)
}

function pageLabel(page: number, perPage: number, total: number) {
  if (!total) return '0 jobs'
  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)
  return `${start}-${end} of ${total}`
}

// ── Primitives ────────────────────────────────────────────────────────

function Dot({ color }: { color: 'green' | 'amber' | 'red' | 'gray' }) {
  return (
    <span
      className={cn(
        'inline-block size-1.5 rounded-full shrink-0',
        color === 'green' && 'bg-emerald-500',
        color === 'amber' && 'bg-amber-500',
        color === 'red' && 'bg-red-500',
        color === 'gray' && 'bg-muted-foreground/40',
      )}
    />
  )
}

function Metric({
  label,
  value,
  variant = 'neutral',
}: {
  label: string
  value: number
  variant?: 'neutral' | 'warn' | 'danger'
}) {
  const active = value > 0
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn(
          'text-xl font-semibold tabular-nums leading-none',
          active && variant === 'danger' && 'text-red-600',
          active && variant === 'warn' && 'text-amber-600',
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function getDefaultJobState(queue: AdminOpsQueueItem): AdminOpsJobState {
  if (queue.active > 0) return 'active'
  if (queue.retry > 0) return 'retry'
  if (queue.failed > 0) return 'failed'
  if (queue.createdReady + queue.deferred > 0) return 'created'
  if (queue.completed > 0) return 'completed'
  if (queue.cancelled > 0) return 'cancelled'
  return 'active'
}

function getJobTabs(queue: AdminOpsQueueItem) {
  return [
    { value: 'active' as const, label: 'Active', count: queue.active },
    { value: 'created' as const, label: 'Queued', count: queue.createdReady + queue.deferred },
    { value: 'retry' as const, label: 'Retry', count: queue.retry },
    { value: 'failed' as const, label: 'Failed', count: queue.failed },
    { value: 'completed' as const, label: 'Completed', count: queue.completed },
    { value: 'cancelled' as const, label: 'Cancelled', count: queue.cancelled },
  ]
}

function NumCell({ value, highlight }: { value: number; highlight?: 'red' | 'amber' }) {
  return (
    <span
      className={cn(
        'tabular-nums text-sm',
        value > 0 && highlight === 'red' && 'font-semibold text-red-600',
        value > 0 && highlight === 'amber' && 'font-semibold text-amber-600',
        value === 0 && 'text-muted-foreground/30',
      )}
    >
      {value}
    </span>
  )
}

// ── Alerts ────────────────────────────────────────────────────────────

function Alerts({ alerts }: { alerts: AdminOpsAlert[] }) {
  if (!alerts.length) return null

  return (
    <div className="space-y-1.5">
      {alerts.map((alert) => (
        <div
          key={`${alert.type}-${alert.title}`}
          className={cn(
            'flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm',
            alert.severity === 'critical'
              ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/5'
              : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5',
          )}
        >
          <AlertTriangle
            className={cn(
              'size-3.5 shrink-0',
              alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600',
            )}
          />
          <span className="font-medium">{alert.title}</span>
          <span className="text-muted-foreground">{alert.message}</span>
        </div>
      ))}
    </div>
  )
}

// ── Metric group ──────────────────────────────────────────────────────

function MetricGroup({
  title,
  dot,
  children,
}: {
  title: string
  dot: 'green' | 'amber' | 'red'
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Dot color={dot} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">{children}</div>
      </CardContent>
    </Card>
  )
}

// ── Section title ─────────────────────────────────────────────────────

function SectionHeader({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
      {count !== undefined && count > 0 ? (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {count}
        </Badge>
      ) : null}
    </CardTitle>
  )
}

function SectionEmpty({ label }: { label: string }) {
  return <p className="px-3 py-6 text-sm text-muted-foreground">{label}</p>
}

function PaginationControls({
  page,
  perPage,
  total,
  loading,
  onPageChange,
}: {
  page: number
  perPage: number
  total: number
  loading: boolean
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{pageLabel(page, perPage, total)}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Page {Math.min(page, pageCount)} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= pageCount}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Project issues ────────────────────────────────────────────────────

function CurrentProjectIssues({ items }: { items: AdminOpsProjectItem[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Current Stuck Projects</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.length ? (
          items.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Dot color="amber" />
                  <span className="text-sm font-medium">{p.name}</span>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {p.provisioningStep || 'provisioning'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pl-3">
                  <span className="text-xs text-muted-foreground">{p.userEmail}</span>
                  {p.error ? (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="max-w-[240px] truncate text-xs text-muted-foreground/70">
                        {p.error}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatAge(p.ageMinutes)}
              </span>
            </div>
          ))
        ) : (
          <SectionEmpty label="No stuck projects right now" />
        )}
      </CardContent>
    </Card>
  )
}

// ── Active deployments ────────────────────────────────────────────────

function ActiveDeploys({ items }: { items: AdminOpsDeploymentActiveItem[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Current Active Deployments</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.length ? (
          items.map((d) => (
            <div
              key={d.id}
              className="flex items-start justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Dot color={d.isStuck ? 'red' : 'green'} />
                  <span className="text-sm font-medium">{d.projectName}</span>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {d.status.replace(/_/g, ' ')}
                  </Badge>
                  {d.isStuck ? (
                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                      stuck
                    </Badge>
                  ) : null}
                </div>
                <span className="pl-3 text-xs text-muted-foreground">{d.userEmail}</span>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatAge(d.ageMinutes)}
              </span>
            </div>
          ))
        ) : (
          <SectionEmpty label="No active deployments right now" />
        )}
      </CardContent>
    </Card>
  )
}

// ── Expandable error row ─────────────────────────────────────────────

function FailureRow({
  name,
  status,
  email,
  time,
  error,
}: {
  name: string
  status: string
  email: string
  time: string
  error: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('rounded-md', error && 'cursor-pointer hover:bg-muted/40')}>
      <button
        type="button"
        className={cn(
          'flex w-full items-start justify-between gap-4 px-3 py-2.5 text-left',
          error && 'cursor-pointer',
        )}
        onClick={() => error && setOpen(!open)}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <Dot color="red" />
            <span className="text-sm font-medium">{name}</span>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {status}
            </Badge>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <div className="flex items-center gap-2 pl-3">
            <span className="text-xs text-muted-foreground">{email}</span>
            {error && !open ? (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="max-w-[400px] truncate text-xs text-muted-foreground/70">
                  {error}
                </span>
              </>
            ) : null}
          </div>
        </div>
        {error ? (
          <ChevronDown
            className={cn(
              'mt-1 size-3.5 shrink-0 text-muted-foreground/50 transition-transform',
              open && 'rotate-180',
            )}
          />
        ) : null}
      </button>
      {open && error ? (
        <pre className="mx-3 mb-2.5 max-h-48 overflow-auto rounded border bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {error}
        </pre>
      ) : null}
    </div>
  )
}

// ── Project failures ──────────────────────────────────────────────────

function ProjectFailures({ items }: { items: AdminOpsProjectItem[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Project Failures In Range</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-0.5 pt-0">
        {items.length ? (
          items.map((p) => (
            <FailureRow
              key={p.id}
              name={p.name}
              status="failed"
              email={p.userEmail}
              time={timeAgoDetailed(p.updatedAt)}
              error={p.error}
            />
          ))
        ) : (
          <SectionEmpty label="No project failures in the selected range" />
        )}
      </CardContent>
    </Card>
  )
}

// ── Deploy failures ──────────────────────────────────────────────────

function DeployFailures({ items }: { items: AdminOpsDeploymentFailureItem[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Deploy Failures In Range</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-0.5 pt-0">
        {items.length ? (
          items.map((d) => (
            <FailureRow
              key={d.id}
              name={d.projectName}
              status={d.status.replace(/_/g, ' ')}
              email={d.userEmail}
              time={timeAgoDetailed(d.finishedAt)}
              error={d.error}
            />
          ))
        ) : (
          <SectionEmpty label="No deployment failures in the selected range" />
        )}
      </CardContent>
    </Card>
  )
}

// ── Queue health ──────────────────────────────────────────────────────

function QueueGroup({
  label,
  items,
  onInspect,
}: {
  label: string
  items: AdminOpsQueueItem[]
  onInspect: (queue: AdminOpsQueueItem) => void
}) {
  if (!items.length) return null

  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </div>
      {items.map((q) => {
        const dotColor =
          q.error || q.failed > 0
            ? 'red'
            : q.createdReady + q.deferred + q.retry + q.active > 0
              ? 'amber'
              : ('green' as const)

        return (
          <button
            key={q.name}
            type="button"
            onClick={() => onInspect(q)}
            className="group grid w-full grid-cols-[1fr_repeat(6,_48px)] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Dot color={dotColor} />
              <span className="text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                {q.label}
              </span>
              {q.isDeadLetter ? (
                <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground/60">
                  DLQ
                </Badge>
              ) : null}
              {q.policy === 'key_strict_fifo' ? (
                <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground/60">
                  fifo
                </Badge>
              ) : null}
              {q.error ? (
                <span className="truncate text-[11px] text-red-600">{q.error}</span>
              ) : null}
            </div>
            <span className="text-right">
              <NumCell value={q.createdReady} />
            </span>
            <span className="text-right">
              <NumCell value={q.active} />
            </span>
            <span className="text-right">
              <NumCell value={q.retry} highlight="amber" />
            </span>
            <span className="text-right">
              <NumCell value={q.failed} highlight="red" />
            </span>
            <span className="text-right">
              <NumCell value={q.blockedKeyCount} highlight="amber" />
            </span>
            <span className="text-right">
              <NumCell value={q.total} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function JobsBrowser({
  queues,
  queue,
  state,
  page,
  perPage,
  total,
  jobs,
  loading,
  error,
  onQueueChange,
  onStateChange,
  onPageChange,
  onInspect,
}: {
  queues: AdminOpsQueueItem[]
  queue: AdminOpsQueueItem | null
  state: AdminOpsJobState
  page: number
  perPage: number
  total: number
  jobs: AdminOpsJobItem[]
  loading: boolean
  error: string | null
  onQueueChange: (queueName: string) => void
  onStateChange: (state: AdminOpsJobState) => void
  onPageChange: (page: number) => void
  onInspect: (queue: AdminOpsQueueItem, jobId: string) => void
}) {
  const tabs = queue ? getJobTabs(queue) : []

  return (
    <Card>
      <CardHeader>
        <SectionHeader count={total}>Job Browser</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap gap-3">
          <Select value={queue?.name} onValueChange={onQueueChange} disabled={!queues.length}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent>
              {queues.map((item) => (
                <SelectItem key={item.name} value={item.name}>
                  {item.label} ({item.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={state}
            onValueChange={(value) => onStateChange(value as AdminOpsJobState)}
            disabled={!queue}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label} ({tab.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {queue ? (
          <PaginationControls
            page={page}
            perPage={perPage}
            total={total}
            loading={loading}
            onPageChange={onPageChange}
          />
        ) : null}

        {!queues.length ? <SectionEmpty label="No queues available to inspect yet" /> : null}
        {queue && !loading && !error && !jobs.length ? (
          <SectionEmpty label="No jobs for the selected queue and status" />
        ) : null}
        {loading ? <SectionEmpty label="Loading jobs..." /> : null}
        {error ? <SectionEmpty label={error} /> : null}

        {queue && !loading && !error && jobs.length ? (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_120px_120px_70px] gap-3 px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              <span>Job</span>
              <span>Status</span>
              <span>Created</span>
              <span>Started</span>
              <span className="text-right">Retry</span>
            </div>
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onInspect(queue, job.id)}
                className="grid w-full grid-cols-[1fr_80px_120px_120px_70px] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs">{job.id}</div>
                  <div className="truncate text-xs text-muted-foreground/60">
                    {job.singletonKey || job.deadLetter || '—'}
                  </div>
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'px-1.5 py-0 text-[10px]',
                      job.state === 'failed' && 'border-red-500/30 text-red-600',
                      job.state === 'active' && 'border-amber-500/30 text-amber-600',
                      job.state === 'completed' && 'border-emerald-500/30 text-emerald-600',
                    )}
                  >
                    {job.state}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(job.createdOn)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(job.startedOn)}
                </span>
                <span className="text-right text-sm tabular-nums text-muted-foreground">
                  {job.retryCount} / {job.retryLimit}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function JobsSheet({
  queue,
  state,
  page,
  perPage,
  total,
  jobs,
  selectedJobId,
  loading,
  error,
  onOpenChange,
  onStateChange,
  onPageChange,
  onSelectJob,
}: {
  queue: AdminOpsQueueItem | null
  state: AdminOpsJobState
  page: number
  perPage: number
  total: number
  jobs: AdminOpsJobItem[]
  selectedJobId: string | null
  loading: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onStateChange: (value: AdminOpsJobState) => void
  onPageChange: (page: number) => void
  onSelectJob: (value: string) => void
}) {
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || jobs[0] || null

  return (
    <Sheet open={Boolean(queue)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        {queue ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{queue.label} Jobs</SheetTitle>
              <SheetDescription>
                {queue.name} · {queue.purpose}
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
              <Tabs
                value={state}
                onValueChange={(value) => onStateChange(value as AdminOpsJobState)}
              >
                <TabsList className="flex h-auto flex-wrap justify-start">
                  {getJobTabs(queue).map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                      {tab.label}
                      <span className="text-[10px] text-muted-foreground">{tab.count}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <PaginationControls
                page={page}
                perPage={perPage}
                total={total}
                loading={loading}
                onPageChange={onPageChange}
              />

              {loading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading jobs
                </div>
              ) : null}

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              {!loading && !error ? (
                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="min-h-0 overflow-y-auto rounded-md border">
                    {!jobs.length ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        No jobs in this state
                      </div>
                    ) : (
                      <div className="divide-y">
                        {jobs.map((job) => (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => onSelectJob(job.id)}
                            className={cn(
                              'w-full space-y-1 px-3 py-3 text-left hover:bg-muted/40',
                              selectedJob?.id === job.id && 'bg-muted',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Dot
                                color={
                                  job.state === 'failed'
                                    ? 'red'
                                    : job.state === 'retry' || job.state === 'active'
                                      ? 'amber'
                                      : 'green'
                                }
                              />
                              <span className="truncate text-sm font-medium">
                                {job.id.slice(0, 8)}
                              </span>
                              {job.singletonKey ? (
                                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                  key
                                </Badge>
                              ) : null}
                            </div>
                            <div className="pl-3 text-xs text-muted-foreground">
                              created {timeAgoDetailed(job.createdOn)}
                            </div>
                            {job.singletonKey ? (
                              <div className="truncate pl-3 text-xs text-muted-foreground/70">
                                {job.singletonKey}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 overflow-y-auto rounded-md border">
                    {selectedJob ? (
                      <div className="space-y-4 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{selectedJob.state}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {selectedJob.id}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Created
                            </p>
                            <p className="text-sm">{formatDateTime(selectedJob.createdOn)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Started
                            </p>
                            <p className="text-sm">{formatDateTime(selectedJob.startedOn)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Completed
                            </p>
                            <p className="text-sm">{formatDateTime(selectedJob.completedOn)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Start After
                            </p>
                            <p className="text-sm">{formatDateTime(selectedJob.startAfter)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Retry
                            </p>
                            <p className="text-sm">
                              {selectedJob.retryCount} / {selectedJob.retryLimit}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Singleton Key
                            </p>
                            <p className="truncate text-sm">{selectedJob.singletonKey || '—'}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Payload
                          </p>
                          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                            {stringify(selectedJob.data)}
                          </pre>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Output
                          </p>
                          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                            {stringify(selectedJob.output)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-sm text-muted-foreground">No job selected</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function QueueHealth({
  items,
  onInspect,
}: {
  items: AdminOpsQueueItem[]
  onInspect: (queue: AdminOpsQueueItem) => void
}) {
  const projectQueues = items.filter((q) => q.category === 'project')
  const paymentQueues = items.filter((q) => q.category === 'payment')
  const otherQueues = items.filter((q) => q.category === 'other')

  return (
    <Card>
      <CardHeader className="pb-0">
        <SectionHeader>Queues</SectionHeader>
      </CardHeader>
      <CardContent>
        {!items.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No queues registered yet</p>
        ) : (
          <div>
            <div className="grid grid-cols-[1fr_repeat(6,_48px)] items-center gap-3 border-b border-border/40 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              <span>Queue</span>
              <span className="text-right">Ready</span>
              <span className="text-right">Active</span>
              <span className="text-right">Retry</span>
              <span className="text-right">Failed</span>
              <span className="text-right">Blocked</span>
              <span className="text-right">Total</span>
            </div>
            <QueueGroup label="Project" items={projectQueues} onInspect={onInspect} />
            <QueueGroup label="Payment" items={paymentQueues} onInspect={onInspect} />
            {otherQueues.length > 0 ? (
              <QueueGroup label="Other" items={otherQueues} onInspect={onInspect} />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────

export function OpsDashboard({ data }: { data: AdminOpsData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [light, setLight] = useState(false)

  useEffect(() => {
    const html = document.documentElement
    if (light) {
      html.classList.remove('dark')
      html.classList.add('light')
      html.style.colorScheme = 'light'
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
      html.style.colorScheme = 'dark'
    }
    return () => {
      html.classList.remove('light')
      html.classList.add('dark')
      html.style.colorScheme = 'dark'
    }
  }, [light])

  const [jobQueue, setJobQueue] = useState<AdminOpsQueueItem | null>(null)
  const [jobSheetOpen, setJobSheetOpen] = useState(false)
  const [jobState, setJobState] = useState<AdminOpsJobState>('active')
  const [jobPage, setJobPage] = useState(1)
  const [jobTotal, setJobTotal] = useState(0)
  const [jobs, setJobs] = useState<AdminOpsJobItem[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => router.refresh())
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [router, startTransition])

  function refresh() {
    startTransition(() => router.refresh())
  }

  function inspectQueue(queue: AdminOpsQueueItem, jobId?: string) {
    setJobQueue(queue)
    setJobState(getDefaultJobState(queue))
    setJobPage(1)
    setJobTotal(0)
    setJobs([])
    setSelectedJobId(jobId || null)
    setJobsError(null)
    setJobSheetOpen(true)
  }

  useEffect(() => {
    if (!jobQueue) return

    let cancelled = false
    setJobsLoading(true)
    setJobsError(null)

    fetch(
      `/api/admin/ops/jobs?queue=${encodeURIComponent(jobQueue.name)}&state=${jobState}&page=${jobPage}&perPage=${JOBS_PER_PAGE}`,
      {
        cache: 'no-store',
      },
    )
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) {
          throw new Error(body.error || 'Failed to load jobs')
        }
        return body
      })
      .then((body: AdminOpsJobsResponse) => {
        if (cancelled) return
        if (!body.jobs.length && body.total > 0 && body.page > 1) {
          setJobPage(Math.ceil(body.total / body.perPage))
          return
        }
        setJobTotal(body.total)
        setJobs(body.jobs)
        setSelectedJobId((current) =>
          current && body.jobs.some((job) => job.id === current)
            ? current
            : (body.jobs[0]?.id ?? null),
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setJobTotal(0)
        setJobs([])
        setSelectedJobId(null)
        setJobsError(err instanceof Error ? err.message : 'Failed to load jobs')
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [JOBS_PER_PAGE, jobPage, jobQueue, jobState])

  const { projects, deployments, queues } = data

  useEffect(() => {
    if (jobQueue || !queues.items.length) return
    const first = queues.items[0]
    if (!first) return
    setJobQueue(first)
    setJobState(getDefaultJobState(first))
    setJobPage(1)
  }, [jobQueue, queues.items])

  const hasIssues = data.alerts.length > 0
  const projectQueueCount = queues.items.filter((queue) => queue.category === 'project').length
  const paymentQueueCount = queues.items.filter((queue) => queue.category === 'payment').length
  const otherQueueCount = queues.items.filter((queue) => queue.category === 'other').length

  const projectDot: 'green' | 'amber' | 'red' =
    projects.summary.stuckProvisioning > 0 || projects.summary.failed > 0
      ? 'red'
      : projects.summary.provisioning > 0
        ? 'amber'
        : 'green'

  const deployDot: 'green' | 'amber' | 'red' =
    deployments.summary.stuckActive > 0 ||
    deployments.summary.buildFailed + deployments.summary.deployFailed > 0
      ? 'red'
      : deployments.summary.active > 0
        ? 'amber'
        : 'green'

  const queueDot: 'green' | 'amber' | 'red' =
    queues.summary.dlqJobs > 0 ? 'red' : queues.summary.retryingJobs > 0 ? 'amber' : 'green'

  const queueInventoryDot: 'green' | 'amber' | 'red' = otherQueueCount > 0 ? 'amber' : 'green'

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="size-8">
              <Link href="/admin">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold">Ops</h1>
            <Badge
              variant={hasIssues ? 'destructive' : 'outline'}
              className={cn(!hasIssues && 'border-emerald-500/40 text-emerald-600')}
            >
              {hasIssues
                ? `${data.alerts.length} alert${data.alerts.length > 1 ? 's' : ''}`
                : 'healthy'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <AdminRangeSelect basePath="/admin/ops" />
            <span className="text-xs text-muted-foreground">
              {timeAgoDetailed(data.generatedAt)}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setLight(!light)}>
              {light ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={refresh}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        <Alerts alerts={data.alerts} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricGroup title="Projects" dot={projectDot}>
            <Metric label="provisioning" value={projects.summary.provisioning} />
            <Metric label="ready" value={projects.summary.ready} />
            <Metric label="stuck" value={projects.summary.stuckProvisioning} variant="danger" />
            <Metric label="failed" value={projects.summary.failed} variant="danger" />
          </MetricGroup>

          <MetricGroup title="Deployments" dot={deployDot}>
            <Metric label="active" value={deployments.summary.active} />
            <Metric label="queued" value={deployments.summary.queued} />
            <Metric label="stuck" value={deployments.summary.stuckActive} variant="danger" />
            <Metric
              label="failed"
              value={deployments.summary.buildFailed + deployments.summary.deployFailed}
              variant="danger"
            />
          </MetricGroup>

          <MetricGroup title="Queue Inventory" dot={queueInventoryDot}>
            <Metric label="project queues" value={projectQueueCount} />
            <Metric label="payment queues" value={paymentQueueCount} />
            {otherQueueCount > 0 ? <Metric label="other queues" value={otherQueueCount} /> : null}
          </MetricGroup>

          <MetricGroup title="Queue Runtime" dot={queueDot}>
            <Metric label="active" value={queues.summary.activeJobs} />
            <Metric label="retrying" value={queues.summary.retryingJobs} variant="warn" />
            <Metric label="DLQ open" value={queues.summary.dlqJobs} variant="danger" />
          </MetricGroup>
        </div>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Problems In Range</span>
              <span className="text-[11px] normal-case tracking-normal text-muted-foreground">
                Since {data.start ? formatDateShort(data.start) : 'today'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <Metric
                label="project failures"
                value={data.problems?.summary?.projectFailures ?? 0}
                variant="danger"
              />
              <Metric
                label="deploy failures"
                value={data.problems?.summary?.deploymentFailures ?? 0}
                variant="danger"
              />
              <Metric
                label="new DLQ jobs"
                value={data.problems?.summary?.dlqJobs ?? 0}
                variant="danger"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Top cards and current issue lists are live state. This row and the failure lists use
              the selected time window.
            </p>
          </CardContent>
        </Card>

        <Separator />

        <div className="grid gap-4 xl:grid-cols-2">
          <CurrentProjectIssues items={projects.stuck} />
          <ActiveDeploys items={deployments.active} />
        </div>

        <ProjectFailures items={projects.recentFailures} />
        <DeployFailures items={deployments.recentFailures} />

        <JobsBrowser
          queues={queues.items}
          queue={jobQueue}
          state={jobState}
          page={jobPage}
          perPage={JOBS_PER_PAGE}
          total={jobTotal}
          jobs={jobs}
          loading={jobsLoading}
          error={jobsError}
          onQueueChange={(queueName) => {
            const next = queues.items.find((item) => item.name === queueName) || null
            setJobQueue(next)
            setJobState(next ? getDefaultJobState(next) : 'active')
            setJobPage(1)
            setJobTotal(0)
            setJobs([])
            setSelectedJobId(null)
            setJobsError(null)
          }}
          onStateChange={(state) => {
            setJobState(state)
            setJobPage(1)
            setJobTotal(0)
            setJobs([])
            setSelectedJobId(null)
            setJobsError(null)
          }}
          onPageChange={setJobPage}
          onInspect={(queue, jobId) => {
            setJobQueue(queue)
            setSelectedJobId(jobId)
            setJobSheetOpen(true)
          }}
        />

        <QueueHealth items={queues.items} onInspect={inspectQueue} />
      </div>

      <JobsSheet
        queue={jobSheetOpen ? jobQueue : null}
        state={jobState}
        page={jobPage}
        perPage={JOBS_PER_PAGE}
        total={jobTotal}
        jobs={jobs}
        selectedJobId={selectedJobId}
        loading={jobsLoading}
        error={jobsError}
        onOpenChange={(open) => {
          setJobSheetOpen(open)
        }}
        onStateChange={(value) => {
          setJobState(value)
          setJobPage(1)
          setJobTotal(0)
          setJobs([])
          setSelectedJobId(null)
        }}
        onPageChange={setJobPage}
        onSelectJob={setSelectedJobId}
      />
    </div>
  )
}
