'use client'

import { CircleNotch, DownloadSimple, Warning, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface WarningBannerProps {
  onDownload: () => void
  downloading: boolean
}

export default function WarningBanner({ onDownload, downloading }: WarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-warning/6 border-b border-warning/15 px-2.5 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm min-w-0">
        <Warning className="size-4 text-warning shrink-0" weight="fill" />
        <span className="truncate">
          <span className="font-medium">Heads up!</span> Projects may be deleted after inactivity.
        </span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          disabled={downloading}
          aria-label="Download project"
          className="h-7 text-xs text-warning hover:bg-warning/20 px-2 sm:px-3"
        >
          {downloading ? (
            <CircleNotch className="size-3.5 animate-spin sm:mr-1.5" />
          ) : (
            <DownloadSimple className="size-3.5 sm:mr-1.5" weight="bold" />
          )}
          <span className="hidden sm:inline">Download</span>
        </Button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss warning"
          className="p-1 rounded hover:bg-warning/20 text-warning"
        >
          <X className="size-4" weight="bold" />
        </button>
      </div>
    </div>
  )
}
