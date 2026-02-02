'use client'

import Image from 'next/image'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SettingsViewProps {
  stripeConnected: boolean
  stripeProcessor?: string
  onDisconnect?: () => void
  isDisconnecting?: boolean
}

export function SettingsView({
  stripeConnected,
  stripeProcessor,
  onDisconnect,
  isDisconnecting,
}: SettingsViewProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-1">Payment Settings</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Manage your payment provider connection and settings
        </p>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-4">
              {stripeProcessor === 'whop' ? (
                <div className="size-12 rounded-xl bg-[#FF6243] grid place-items-center">
                  <Image
                    src="/whop_logo_brandmark_orange.svg"
                    alt="Whop"
                    width={28}
                    height={14}
                    className="brightness-0 invert"
                  />
                </div>
              ) : (
                <div className="size-12 rounded-xl overflow-hidden">
                  <Image src="/Stripe_icon_-_square.svg" alt="Stripe" width={48} height={48} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold capitalize">{stripeProcessor || 'Stripe'}</h3>
                  {stripeConnected && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {stripeConnected
                    ? 'Your payment provider is connected and ready'
                    : 'Connect a payment provider to start accepting payments'}
                </p>
              </div>
            </div>
          </div>
          {stripeConnected && onDisconnect && (
            <div className="px-5 py-3 border-t bg-muted/30">
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect account'}
              </button>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
