'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface SettingsViewProps {
  isConnected: boolean
  processor?: string
  onDisconnect?: () => void
  isDisconnecting?: boolean
}

export function SettingsView({
  isConnected,
  processor,
  onDisconnect,
  isDisconnecting,
}: SettingsViewProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-[1080px] p-5">
        <div className="max-w-lg">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    isConnected ? 'bg-emerald-500' : 'bg-neutral-400',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold">Payment Provider</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {isConnected
                      ? 'Connected and ready to process payments'
                      : 'Connect a payment provider to start accepting payments'}
                  </p>
                </div>
              </div>
            </div>
            {isConnected && onDisconnect && (
              <div className="px-5 py-3 border-t">
                <button
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  className="text-[13px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
