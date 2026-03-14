'use client'

import { DeviceMobile, DeviceTablet, Monitor } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type DeviceFrame = 'mobile' | 'tablet' | 'desktop'

interface DeviceFrameSelectorProps {
  value: DeviceFrame
  onChange: (frame: DeviceFrame) => void
}

const frames: { id: DeviceFrame; icon: typeof DeviceMobile; label: string }[] = [
  { id: 'mobile', icon: DeviceMobile, label: 'Mobile' },
  { id: 'tablet', icon: DeviceTablet, label: 'Tablet' },
  { id: 'desktop', icon: Monitor, label: 'Desktop' },
]

export function DeviceFrameSelector({ value, onChange }: DeviceFrameSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5">
      {frames.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center justify-center size-6 rounded transition-colors',
            value === id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label={label}
        >
          <Icon className="size-3.5" weight={value === id ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  )
}
