'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { RocketLaunch, Bell } from '@phosphor-icons/react'
import WorkspaceSidebar from '@/components/workspace/sidebar'
import { Button } from '@/components/ui/button'

const SECTIONS: Record<string, string> = {
  '': 'Dashboard',
  editor: 'Editor',
  analytics: 'Analytics',
  settings: 'Settings',
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { companyId } = useParams<{ companyId: string }>()
  const pathname = usePathname()
  const base = `/company/${companyId}`
  const section = pathname.replace(base, '').replace(/^\//, '').split('/')[0] || ''

  return (
    <div className="h-dvh flex bg-muted dark:bg-background">
      <WorkspaceSidebar companyId={companyId} />

      {/* Content frame */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 md:py-1.5 md:pr-1.5">
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-card md:rounded-lg overflow-hidden">
          <header className="flex shrink-0 items-center px-8 lg:px-12 pt-5 pb-3">
            <div className="flex items-center gap-1.5 text-[13px] max-w-5xl w-full mx-auto">
              <Link
                href={base}
                className="text-muted-foreground/35 hover:text-foreground transition-colors"
              >
                Project
              </Link>
              {section && (
                <>
                  <span className="text-muted-foreground/15">/</span>
                  <span className="font-medium text-foreground">
                    {SECTIONS[section] || section}
                  </span>
                </>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <button className="size-7 rounded-md flex items-center justify-center text-muted-foreground/25 hover:text-foreground transition-colors">
                  <Bell className="size-3.5" weight="regular" />
                </button>
                <Button variant="brand" size="sm" className="h-6 gap-1 text-[11px] px-2.5">
                  <RocketLaunch className="size-3" weight="fill" />
                  Publish
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-8 py-5 lg:px-12">
            <div className="max-w-5xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
