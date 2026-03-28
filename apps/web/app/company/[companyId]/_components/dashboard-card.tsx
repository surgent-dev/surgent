'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface DashboardCardProps {
  title: string
  icon: React.ElementType
  href?: string
  className?: string
  action?: React.ReactNode
  headerRight?: React.ReactNode
  children: React.ReactNode
}

export function DashboardCard({
  title,
  icon: Icon,
  href,
  className,
  action,
  headerRight,
  children,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl bg-foreground/[0.03] dark:bg-white/[0.04] min-h-[280px]',
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5 py-0.5">
          <div className="size-6 rounded-md bg-brand/10 flex items-center justify-center">
            <Icon className="size-3.5 text-brand" weight="fill" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {href && (
            <Link
              href={href}
              className="text-[13px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {action || 'View'}
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col px-3 pb-3">{children}</div>
    </div>
  )
}
