'use client'

import { CaretDown, DeviceMobile, DeviceTablet, Monitor } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type DeviceFrame = 'mobile' | 'tablet' | 'desktop'

interface DeviceFrameSelectorProps {
  value: DeviceFrame
  onChange: (frame: DeviceFrame) => void
}

const frames: { id: DeviceFrame; icon: typeof Monitor; label: string }[] = [
  { id: 'desktop', icon: Monitor, label: 'Desktop' },
  { id: 'tablet', icon: DeviceTablet, label: 'Tablet' },
  { id: 'mobile', icon: DeviceMobile, label: 'Mobile' },
]

export function DeviceFrameSelector({ value, onChange }: DeviceFrameSelectorProps) {
  const current = frames.find((f) => f.id === value) || frames[0]!
  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon className="size-3.5" weight="regular" />
          {current.label}
          <CaretDown className="size-3 opacity-40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {frames.map(({ id, icon: ItemIcon, label }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => onChange(id)}
            className="cursor-pointer gap-2 text-xs"
          >
            <ItemIcon className="size-3.5" weight={value === id ? 'fill' : 'regular'} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
