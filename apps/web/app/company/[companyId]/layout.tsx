'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Bell } from '@phosphor-icons/react'
import WorkspaceSidebar from '@/components/workspace/sidebar'

const SECTIONS: Record<string, string> = {
  '': 'Dashboard',
  editor: 'Studio',
  analytics: 'Analytics',
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { companyId } = useParams<{ companyId: string }>()
  const pathname = usePathname()
  const base = `/company/${companyId}`
  const section = pathname.replace(base, '').replace(/^\//, '').split('/')[0] || ''
  const isEditor = section === 'editor'

  if (isEditor) {
    return (
      <div className="h-dvh flex bg-muted dark:bg-background">
        <WorkspaceSidebar companyId={companyId} />
        <div className="flex-1 min-w-0 min-h-0 md:py-1.5 md:pr-1.5">{children}</div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex bg-muted dark:bg-background">
      <WorkspaceSidebar companyId={companyId} />

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
              <button className="size-7 rounded-md flex items-center justify-center text-muted-foreground/25 hover:text-foreground transition-colors cursor-pointer">
                <Bell className="size-3.5" weight="regular" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-8 py-5 lg:px-12">
            <div className="max-w-5xl mx-auto h-full">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
