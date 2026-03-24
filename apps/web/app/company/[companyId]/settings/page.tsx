'use client'

import { GearSix } from '@phosphor-icons/react'

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground/50">Project configuration</p>
      </div>
      <div className="rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04] flex flex-col items-center justify-center py-20">
        <div className="rounded-full bg-foreground/[0.04] p-3 mb-3">
          <GearSix className="size-5 text-muted-foreground/40" weight="duotone" />
        </div>
        <p className="text-sm font-medium">Coming soon</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Environment variables, integrations, and more
        </p>
      </div>
    </div>
  )
}
