'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ChevronDown, Loader2, Moon, RefreshCw, Sun } from 'lucide-react'
import { AdminRangeSelect } from '@/components/admin/admin-range-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type {
  AdminOpsAlert,
  AdminOpsData,
  AdminOpsDeploymentActiveItem,
  AdminOpsDeploymentFailureItem,
  AdminOpsProjectItem,
  AdminOpsQueueItem,
} from './types'

// ── Helpers ───────────────────────────────────────────────────────────

function timeAgo(value: string) {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

function TH({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'h-8 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70',
        className,
      )}
    >
      {children}
    </th>
  )
}

function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('h-10 text-sm align-top', className)}>{children}</td>
}

function NumTD({ value, highlight }: { value: number; highlight?: 'red' | 'amber' }) {
  return (
    <TD
      className={cn(
        'text-right tabular-nums',
        value > 0 && highlight === 'red' && 'font-medium text-red-600',
        value > 0 && highlight === 'amber' && 'font-medium text-amber-600',
        value === 0 && 'text-muted-foreground/40',
      )}
    >
      {value}
    </TD>
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

// ── Project issues ────────────────────────────────────────────────────

function CurrentProjectIssues({ items }: { items: AdminOpsProjectItem[] }) {
  if (!items.length) return null

  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Current Stuck Projects</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.map((p) => (
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
        ))}
      </CardContent>
    </Card>
  )
}

// ── Active deployments ────────────────────────────────────────────────

function ActiveDeploys({ items }: { items: AdminOpsDeploymentActiveItem[] }) {
  if (!items.length) return null

  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Current Active Deployments</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.map((d) => (
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
        ))}
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
  if (!items.length) return null

  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Project Failures In Range</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-0.5 pt-0">
        {items.map((p) => (
          <FailureRow
            key={p.id}
            name={p.name}
            status="failed"
            email={p.userEmail}
            time={timeAgo(p.updatedAt)}
            error={p.error}
          />
        ))}
      </CardContent>
    </Card>
  )
}

// ── Deploy failures ──────────────────────────────────────────────────

function DeployFailures({ items }: { items: AdminOpsDeploymentFailureItem[] }) {
  if (!items.length) return null

  return (
    <Card>
      <CardHeader>
        <SectionHeader count={items.length}>Deploy Failures In Range</SectionHeader>
      </CardHeader>
      <CardContent className="space-y-0.5 pt-0">
        {items.map((d) => (
          <FailureRow
            key={d.id}
            name={d.projectName}
            status={d.status.replace(/_/g, ' ')}
            email={d.userEmail}
            time={timeAgo(d.finishedAt)}
            error={d.error}
          />
        ))}
      </CardContent>
    </Card>
  )
}

// ── Queue health ──────────────────────────────────────────────────────

function QueueGroup({ label, items }: { label: string; items: AdminOpsQueueItem[] }) {
  if (!items.length) return null

  return (
    <>
      <tr>
        <td
          colSpan={7}
          className="pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50"
        >
          {label}
        </td>
      </tr>
      {items.map((q) => (
        <tr key={q.name} className="border-b border-border/15 last:border-0">
          <TD>
            <div className="flex items-center gap-1.5">
              <Dot
                color={
                  q.error || q.failed > 0
                    ? 'red'
                    : q.createdReady + q.deferred + q.retry + q.active > 0
                      ? 'amber'
                      : 'green'
                }
              />
              <span className="font-medium">{q.label}</span>
              {q.isDeadLetter ? (
                <span className="text-[10px] text-muted-foreground/50">DLQ</span>
              ) : null}
              {q.policy === 'key_strict_fifo' ? (
                <span className="text-[10px] text-muted-foreground/50">fifo</span>
              ) : null}
            </div>
            {q.error ? <p className="ml-3 text-[11px] text-red-600">{q.error}</p> : null}
          </TD>
          <NumTD value={q.createdReady} />
          <NumTD value={q.active} />
          <NumTD value={q.retry} highlight="amber" />
          <NumTD value={q.failed} highlight="red" />
          <NumTD value={q.blockedKeyCount} highlight="amber" />
          <NumTD value={q.total} />
        </tr>
      ))}
    </>
  )
}

function QueueHealth({ items }: { items: AdminOpsQueueItem[] }) {
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40">
                <TH>Queue</TH>
                <TH className="text-right">Ready</TH>
                <TH className="text-right">Active</TH>
                <TH className="text-right">Retry</TH>
                <TH className="text-right">Failed</TH>
                <TH className="text-right">Blocked</TH>
                <TH className="text-right">Total</TH>
              </tr>
            </thead>
            <tbody>
              <QueueGroup label="Project" items={projectQueues} />
              <QueueGroup label="Payment" items={paymentQueues} />
              {otherQueues.length > 0 ? <QueueGroup label="Other" items={otherQueues} /> : null}
            </tbody>
          </table>
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
    const timer = window.setInterval(() => {
      startTransition(() => router.refresh())
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [router, startTransition])

  function refresh() {
    startTransition(() => router.refresh())
  }

  const { projects, deployments, queues } = data
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
    <div className={cn('min-h-screen bg-background', light ? 'light' : 'dark')}>
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
            <span className="text-xs text-muted-foreground">{timeAgo(data.generatedAt)}</span>
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
                Since {data.start ? formatDate(data.start) : 'today'}
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

        <QueueHealth items={queues.items} />
      </div>
    </div>
  )
}
