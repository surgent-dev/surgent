'use client'

import Image from 'next/image'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type ProviderModel = {
  id: string
  name?: string
  providerId: string
  providerName: string
  limit?: { context: number }
}

type Props = {
  models: ProviderModel[]
  selectedModel?: { modelId: string; providerId: string }
  onSelect: (modelId: string, providerId: string) => void
}

type ModelInfo = {
  name: string
  icon: string
  badge?: string
  badgeColor?: string
}

const MODEL_INFO: Record<string, ModelInfo> = {
  'gpt-5.2-codex': {
    name: 'GPT-5.2 Codex',
    icon: '/OpenAI-logo.svg',
    badge: 'Best',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  'claude-opus-4-5': {
    name: 'Claude Code',
    icon: '/claude-logo.svg',
    badge: 'Smart',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  'gemini-3-flash': {
    name: 'Gemini 3 Flash',
    icon: '/google-gemini.svg',
    badge: 'Fast',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  'gemini-3-pro': {
    name: 'Gemini 3 Pro',
    icon: '/google-gemini.svg',
    badge: 'Pro',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
}

export default function ModelSelectorDropdown({ models, selectedModel, onSelect }: Props) {
  const currentModel = selectedModel
    ? models.find(
        (m) => m.id === selectedModel.modelId && m.providerId === selectedModel.providerId,
      )
    : models[0]

  const currentInfo = currentModel ? MODEL_INFO[currentModel.id] : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all flex items-center gap-2 outline-none border border-transparent hover:border-border/50">
          {currentInfo ? (
            <>
              <Image src={currentInfo.icon} alt="" width={14} height={14} className="opacity-80" />
              <span className="font-medium">{currentInfo.name}</span>
            </>
          ) : (
            <span>Select model</span>
          )}
          <ChevronDown className="size-3 opacity-40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px] p-1">
        {models.map((model) => {
          const isSelected =
            selectedModel?.modelId === model.id && selectedModel?.providerId === model.providerId
          const info = MODEL_INFO[model.id]

          return (
            <DropdownMenuItem
              key={`${model.providerId}-${model.id}`}
              onClick={() => onSelect(model.id, model.providerId)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer',
                isSelected && 'bg-muted',
              )}
            >
              {info && <Image src={info.icon} alt="" width={16} height={16} className="shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {info?.name || model.name || model.id}
                  </span>
                  {info?.badge && (
                    <span
                      className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded',
                        info.badgeColor,
                      )}
                    >
                      {info.badge}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <Check className="size-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
