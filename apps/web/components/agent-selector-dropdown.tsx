'use client'

import { Check, ChevronDown, Bot, Sparkles } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Agent } from '@opencode-ai/sdk'

type Props = {
  agents: Agent[]
  selectedAgent?: string
  onSelect: (agentName: string) => void
}

const AGENT_ICONS: Record<string, typeof Bot> = {
  build: Sparkles,
  plan: Bot,
}

const AGENT_BADGE: Record<string, { label: string; color: string }> = {
  build: { label: 'Agent', color: 'bg-brand/10 text-brand' },
  plan: { label: 'Chat', color: 'bg-muted text-muted-foreground' },
}

export default function AgentSelectorDropdown({ agents, selectedAgent, onSelect }: Props) {
  const currentAgent = agents.find((a) => a.name === selectedAgent) ?? agents[0]
  const Icon = currentAgent ? (AGENT_ICONS[currentAgent.name] ?? Bot) : Bot
  const badge = currentAgent ? AGENT_BADGE[currentAgent.name] : null

  if (agents.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all flex items-center gap-2 outline-none border border-transparent hover:border-border/50">
          <Icon className="size-3.5 opacity-80" />
          <span className="font-medium capitalize">{currentAgent?.name ?? 'Agent'}</span>
          {badge && (
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', badge.color)}>{badge.label}</span>
          )}
          <ChevronDown className="size-3 opacity-40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px] p-1">
        {agents.map((agent) => {
          const isSelected = agent.name === selectedAgent
          const AgentIcon = AGENT_ICONS[agent.name] ?? Bot
          const agentBadge = AGENT_BADGE[agent.name]

          return (
            <DropdownMenuItem
              key={agent.name}
              onClick={() => onSelect(agent.name)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer',
                isSelected && 'bg-muted',
              )}
            >
              <AgentIcon className="size-4 shrink-0" style={{ color: agent.color || undefined }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm capitalize truncate">{agent.name}</span>
                  {agentBadge && (
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', agentBadge.color)}>
                      {agentBadge.label}
                    </span>
                  )}
                </div>
                {agent.description && <p className="text-[11px] text-muted-foreground truncate">{agent.description}</p>}
              </div>
              {isSelected && <Check className="size-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
