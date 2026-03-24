'use client'

import { ChatCircle, MonitorPlay, ArrowsOutSimple } from '@phosphor-icons/react'

export default function EditorPage() {
  return (
    <div className="flex flex-col h-full rounded-xl bg-foreground/[0.03] dark:bg-white/[0.04] overflow-hidden">
      <div className="flex h-10 items-center px-3 gap-2 shrink-0">
        <MonitorPlay className="size-4 text-muted-foreground" weight="duotone" />
        <span className="text-[13px] text-muted-foreground">Preview</span>
        <span className="text-xs text-muted-foreground/40 font-mono truncate">localhost:5173</span>
        <div className="flex-1" />
        <button className="inline-flex items-center justify-center size-7 rounded-lg bg-white/80 dark:bg-white/[0.05] border border-foreground/[0.04] text-foreground/55 hover:border-foreground/[0.08] hover:text-foreground transition-colors cursor-pointer">
          <ArrowsOutSimple className="size-3.5" />
        </button>
        <button className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-white/80 dark:bg-white/[0.05] border border-foreground/[0.04] text-[13px] font-medium text-foreground/55 hover:border-foreground/[0.08] hover:text-foreground transition-colors cursor-pointer">
          <ChatCircle className="size-3.5" weight="fill" />
          Chat
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-12 rounded-xl bg-foreground/[0.04] flex items-center justify-center mb-3">
            <MonitorPlay className="size-6 text-muted-foreground/40" weight="duotone" />
          </div>
          <p className="text-sm font-medium">Website Editor</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Full-screen preview with AI chat</p>
        </div>
      </div>
    </div>
  )
}
