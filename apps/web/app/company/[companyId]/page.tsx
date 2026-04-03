'use client'

import {
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  Eye,
  Globe,
  RocketLaunch,
  Sparkle,
} from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { passthroughImageLoader } from '@/lib/image-loader'
import { cn } from '@/lib/utils'
import type { DateRangeValue } from '@/queries/analytics'
import { useLatestDeploymentQuery, useProjectQuery } from '@/queries/projects'
import { AnalyticsCard } from './_components/analytics-card'
import { DashboardCard } from './_components/dashboard-card'
import { PaymentsCard } from './_components/payments-card'

function StepRow({
  step,
  label,
  isLast,
  onClick,
}: {
  step: number
  label: string
  isLast?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-3 px-1 text-sm text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
    >
      <div className="flex flex-col items-center self-stretch shrink-0">
        <span className="size-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-semibold text-brand">
          {step}
        </span>
        {!isLast && <span className="flex-1 w-px bg-brand/10 mt-1" />}
      </div>
      <span className="flex-1 text-left font-medium pt-1.5 pb-4">{label}</span>
      <CaretRight className="size-3.5 mt-2 shrink-0 text-foreground/15 group-hover:text-foreground/40 transition-colors" />
    </button>
  )
}

const actionBtn =
  'inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium rounded-xl bg-white/80 dark:bg-white/[0.05] border border-foreground/[0.04] text-foreground/55 hover:border-foreground/[0.08] hover:text-foreground transition-colors cursor-pointer'

const PERIODS: Array<{ label: string; value: DateRangeValue }> = [
  { label: 'Last 24h', value: '24hour' },
  { label: 'Last 7 days', value: '7day' },
  { label: 'Last 30 days', value: '30day' },
  { label: 'Last 90 days', value: '90day' },
]

export default function DashboardPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const base = `/company/${companyId}`
  const [rangeValue, setRangeValue] = useState<DateRangeValue>('7day')
  const { data: project } = useProjectQuery(companyId)
  const { data: latestDeployment } = useLatestDeploymentQuery(companyId)

  const isDeployed = latestDeployment?.status === 'deployed' && latestDeployment.hostname
  const hostname = latestDeployment?.hostname?.replace(/^https?:\/\//, '') ?? ''
  const liveUrl = isDeployed ? `https://${hostname}` : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <p className="text-xl font-semibold leading-tight text-foreground/80">
          <span className="block">Welcome back,</span>
          <span className="block">here&rsquo;s your overview</span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium text-foreground/55 bg-foreground/[0.03] dark:bg-white/[0.04] hover:bg-foreground/[0.06] transition-colors cursor-pointer focus-visible:outline-none shrink-0">
            {PERIODS.find((p) => p.value === rangeValue)?.label ?? 'Last 7 days'}
            <CaretDown className="size-3 text-muted-foreground/30" weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="min-w-32 p-1">
            {PERIODS.map((p) => (
              <DropdownMenuItem
                key={p.value}
                onClick={() => setRangeValue(p.value)}
                className={cn(
                  'text-xs px-2 py-1.5 rounded-md cursor-pointer',
                  p.value === rangeValue ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DashboardCard
          title="Website"
          icon={Eye}
          href={`${base}/editor`}
          action="Edit website"
          headerRight={
            !isDeployed ? (
              <span className="text-[10px] font-medium text-brand/60 bg-brand/[0.08] rounded-full px-2 py-px">
                In progress
              </span>
            ) : undefined
          }
          className="lg:col-span-2"
        >
          {isDeployed && liveUrl ? (
            <>
              <Link
                href={`${base}/editor`}
                className="group/window rounded-lg border border-foreground/[0.06] overflow-hidden flex flex-col bg-white dark:bg-[#1a1a1a]"
              >
                <div className="flex items-center px-3 py-1.5 gap-1.5 shrink-0 border-b border-foreground/[0.04]">
                  <span className="size-[7px] rounded-full bg-[#FF5F57]" />
                  <span className="size-[7px] rounded-full bg-[#FEBC2E]" />
                  <span className="size-[7px] rounded-full bg-[#28C840]" />
                  <span className="flex-1 text-center text-[9px] font-mono text-foreground/25 truncate px-4">
                    https://{hostname}
                  </span>
                  <button
                    className="text-foreground/15 hover:text-foreground transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      window.open(liveUrl!, '_blank', 'noopener')
                    }}
                  >
                    <ArrowSquareOut className="size-3" />
                  </button>
                </div>
                <div className="relative h-[200px] sm:h-[340px] overflow-hidden bg-muted/30 dark:bg-black/10">
                  {latestDeployment!.screenshotUrl ? (
                    <Image
                      loader={passthroughImageLoader}
                      unoptimized
                      src={`${latestDeployment!.screenshotUrl}?v=${latestDeployment!.id}`}
                      alt="Site preview"
                      fill
                      className="w-full h-full object-contain object-top"
                    />
                  ) : (
                    <div className="w-full h-full relative">
                      <iframe
                        src={liveUrl!}
                        className="absolute inset-0 w-[200%] h-[200%] pointer-events-none border-0 origin-top-left scale-50"
                        title="Live site preview"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              </Link>
              <div className="mt-2 min-h-5" aria-hidden="true" />
            </>
          ) : (
            <>
              <Link
                href={`${base}/editor`}
                className="rounded-lg border border-foreground/[0.06] overflow-hidden flex flex-col bg-white dark:bg-[#1a1a1a]"
              >
                {/* Title bar */}
                <div className="flex items-center px-3 py-1.5 gap-1.5 shrink-0 border-b border-foreground/[0.04]">
                  <span className="size-[7px] rounded-full bg-foreground/[0.07]" />
                  <span className="size-[7px] rounded-full bg-foreground/[0.07]" />
                  <span className="size-[7px] rounded-full bg-foreground/[0.07]" />
                </div>
                {/* Empty state */}
                <div className="h-[200px] sm:h-[340px] flex flex-col items-center justify-center gap-2 bg-muted/30 dark:bg-black/10">
                  <Globe className="size-6 text-muted-foreground/15" />
                  <p className="text-[12px] text-muted-foreground/30">Not published</p>
                </div>
              </Link>
              <div className="flex items-center gap-2 mt-2 px-1 min-h-5">
                <span className="relative size-1.5 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-brand/60 animate-ping" />
                  <span className="relative block size-1.5 rounded-full bg-brand" />
                </span>
                <span className="text-[11px] font-mono text-muted-foreground/35 truncate">
                  {project?.name
                    ? `${project.name.toLowerCase().replace(/\s+/g, '-')}.surgent.site`
                    : 'yoursite.surgent.site'}
                </span>
              </div>
            </>
          )}
        </DashboardCard>

        <DashboardCard title="Get started" icon={RocketLaunch}>
          <div className="flex flex-col">
            <StepRow step={1} label="Edit your website" />
            <StepRow step={2} label="Connect a domain" />
            <StepRow step={3} label="Publish your site" />
            <StepRow step={4} label="Set up payments" isLast />
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DashboardCard title="AI Agent" icon={Sparkle}>
          <div className="flex flex-col gap-0.5">
            {['Write a blog post', 'Create social content', 'Analyze competitors'].map((t) => (
              <Link
                key={t}
                href={`${base}/editor`}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
              >
                <Sparkle className="size-4 shrink-0 text-foreground/20" />
                <span className="truncate">{t}</span>
              </Link>
            ))}
          </div>
          <div className="mt-auto pt-3">
            <Link href={`${base}/editor`} className={actionBtn}>
              Start a chat
            </Link>
          </div>
        </DashboardCard>

        <PaymentsCard projectId={companyId} href={`${base}/editor`} />

        <AnalyticsCard projectId={companyId} href={`${base}/analytics`} rangeValue={rangeValue} />
      </div>
    </div>
  )
}
