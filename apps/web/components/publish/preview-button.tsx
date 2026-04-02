'use client'

import { Eye } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSandbox } from '@/hooks/use-sandbox'
import { DeviceFrameSelector } from './device-frame-selector'

export function PreviewButton() {
  const isMobile = useIsMobile()
  const deviceFrame = useSandbox((s) => s.deviceFrame)
  const setDeviceFrame = useSandbox((s) => s.setDeviceFrame)

  if (isMobile) {
    return null
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" aria-label="Preview settings">
              <Eye className="size-4" weight="bold" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Preview device frames</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-auto p-2">
        <DeviceFrameSelector
          value={deviceFrame ?? 'desktop'}
          onChange={(frame) => setDeviceFrame(frame === 'desktop' ? null : frame)}
        />
      </PopoverContent>
    </Popover>
  )
}
