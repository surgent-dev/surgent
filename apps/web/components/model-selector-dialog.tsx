'use client'

import { useState, useMemo } from 'react'
import { Search, X, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export type ProviderModel = {
  id: string
  name?: string
  providerId: string
  providerName: string
  limit?: { context: number }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: ProviderModel[]
  selectedModel?: { modelId: string; providerId: string }
  onSelect: (modelId: string, providerId: string) => void
}

const PROVIDER_COLORS: Record<string, string> = {
  opencode: 'bg-primary',
  anthropic: 'bg-provider-anthropic',
  openai: 'bg-provider-openai',
  google: 'bg-provider-google',
  'github-copilot': 'bg-provider-github-copilot',
}

const MODEL_TAGS: Record<string, string> = {
  'gemini-3-flash-preview': 'UI Developer',
  'gemini-3-pro-preview': 'Full-stack Developer',
  'gpt-5.2': 'Cracked engineer',
  'gpt-5': 'Smart but slower',
  'gpt-4o': 'Quick chatty',
  'claude-opus-4-5': 'Best Engineer',
}

export default function ModelSelectorDialog({ open, onOpenChange, models, selectedModel, onSelect }: Props) {
  const [search, setSearch] = useState('')

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models
    return models.filter((m) => (m.name || m.id).toLowerCase().includes(search.toLowerCase()))
  }, [models, search])

  const handleSelect = (model: ProviderModel) => {
    onSelect(model.id, model.providerId)
    onOpenChange(false)
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) setSearch('')
    onOpenChange(isOpen)
  }

  const ModelRow = ({ model }: { model: ProviderModel }) => {
    const isSelected = selectedModel?.modelId === model.id && selectedModel?.providerId === model.providerId
    const tag = MODEL_TAGS[model.id]

    return (
      <button
        onClick={() => handleSelect(model)}
        className={cn(
          'w-full h-10 flex items-center gap-3 px-4 text-sm transition-colors',
          isSelected ? 'bg-muted' : 'hover:bg-muted/40',
        )}
      >
        <span className="flex-1 text-left font-medium truncate">{tag || model.name || model.id}</span>
        <span className="text-xs text-muted-foreground truncate max-w-24">{model.name || model.id}</span>
        {isSelected && <Check className="size-4 shrink-0" />}
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[300px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="h-12 px-4 flex flex-row items-center border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', PROVIDER_COLORS.opencode)} />
            <DialogTitle className="text-sm font-medium">OpenCode</DialogTitle>
          </div>
        </DialogHeader>

        <div className="h-10 px-4 flex items-center gap-2.5 border-b bg-muted/20">
          <Search className="size-4 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[300px]">
          {filteredModels.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No models found</div>
          ) : (
            filteredModels.map((model) => <ModelRow key={model.id} model={model} />)
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
