'use client'

import { Headset, Envelope, DiscordLogo, TelegramLogo, Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function SupportMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <Headset className="size-4" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Support</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-xs"
          onClick={() => navigator.clipboard.writeText('avron@surgent.dev')}
        >
          <Envelope className="size-3.5 text-muted-foreground/60" weight="duotone" />
          avron@surgent.dev
          <Copy className="ml-auto size-3 text-muted-foreground/30" weight="bold" />
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs">
          <a href="https://discord.gg/DRWbFEtY" target="_blank" rel="noopener noreferrer">
            <DiscordLogo className="size-3.5 text-muted-foreground/60" weight="fill" />
            Discord
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs">
          <a href="https://t.me/bensurgent" target="_blank" rel="noopener noreferrer">
            <TelegramLogo className="size-3.5 text-muted-foreground/60" weight="fill" />
            Telegram
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
