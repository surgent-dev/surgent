'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsageQuery } from '@/queries/usage'
import { CurrencyDollar } from '@phosphor-icons/react'

const LIMIT_DOLLARS = 10

function toDollars(costMicro: string) {
  return Number(BigInt(costMicro)) / 100_000_000
}

function fmtDollars(dollars: number) {
  if (dollars >= 1) return `$${dollars.toFixed(2)}`
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`
  if (dollars > 0) return `$${dollars.toFixed(4)}`
  return '$0.00'
}

const RANGES = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

export default function UsageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [days, setDays] = useState(30)

  const { data, isLoading, isError } = useUsageQuery(undefined, { enabled: open, days })

  const summary = useMemo(() => {
    if (!data) return null
    const dollars = toDollars(data.totals.cost)
    const pct = Math.min((dollars / LIMIT_DOLLARS) * 100, 100)
    return { dollars, pct }
  }, [data])

  const projectsWithDollars = useMemo(() => {
    if (!data?.projects?.length || !summary) return []
    const total = summary.dollars > 0 ? summary.dollars : 1
    return data.projects.map((p) => {
      const dollars = toDollars(p.cost)
      const pct = (dollars / total) * 100
      return { ...p, dollars, pct }
    })
  }, [data?.projects, summary])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Usage</DialogTitle>
        </DialogHeader>

        {isError ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Failed to load usage</p>
        ) : (
          <div className="space-y-4">
            {/* Range picker */}
            <div className="flex items-center gap-1 rounded-full border p-0.5 w-fit">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDays(r.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    days === r.value
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Overall usage */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <CurrencyDollar className="size-5 text-emerald-500" weight="fill" />
                  {isLoading || !summary ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <span className="text-2xl font-bold tabular-nums">
                      {fmtDollars(summary.dollars)}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">/ ${LIMIT_DOLLARS}</span>
              </div>
              {isLoading || !summary ? (
                <Skeleton className="h-2.5 w-full rounded-full" />
              ) : (
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      summary.pct >= 90
                        ? 'bg-rose-500'
                        : summary.pct >= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(summary.pct, 0.5)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Projects */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Projects
              </span>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
              ) : projectsWithDollars.length ? (
                <div className="space-y-1.5">
                  {projectsWithDollars.slice(0, 5).map((p) => (
                    <div
                      key={p.projectId}
                      className="relative rounded-lg border bg-muted/20 px-3 py-2 overflow-hidden"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-foreground/3 transition-all duration-500"
                        style={{ width: `${Math.max(p.pct, 0)}%` }}
                      />
                      <div className="relative flex items-center justify-between gap-3">
                        <span className="text-sm font-medium truncate">{p.projectName}</span>
                        <span className="text-sm tabular-nums shrink-0 text-muted-foreground">
                          {fmtDollars(p.dollars)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 rounded-lg border border-dashed">
                  No projects yet
                </p>
              )}
            </div>

            {/* Footer */}
            {!isLoading && summary?.dollars === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center">
                Cost shows as $0 when using your own API keys
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
