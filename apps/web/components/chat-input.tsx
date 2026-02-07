import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { ArrowUp, X, Loader2, FileText } from 'lucide-react'
import { Sliders, Paperclip, Plug } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  fileToDataUrl,
  uploadFile,
  attachmentsToParts,
  type UploadingAttachment,
  type FilePart,
} from '@/lib/upload'
import { useMcpStatusQuery } from '@/queries/mcp'
import { MODELS, type ProviderModel } from '@/lib/models'
import ModelSelectorDropdown from './model-selector-dropdown'
import type { Agent } from '@opencode-ai/sdk'

export type { FilePart }

type Props = {
  onSubmit: (
    value: string,
    files?: FilePart[],
    model?: string,
    providerID?: string,
    variant?: string,
    isMax?: boolean,
  ) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
  mode?: 'plan' | 'orchestrator'
  onToggleMode?: () => void
  isWorking?: boolean
  onStop?: () => void
  isStopping?: boolean
  value?: string
  onValueChange?: (value: string) => void
  models?: ProviderModel[]
  selectedModel?: { modelId: string; providerId: string }
  onModelChange?: (modelId: string, providerId: string) => void
  subagents?: Agent[]
}

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Provider reasoning variants (1:1 mapping to UI levels)
// OpenAI: 1x=low, 2x=medium, 3x=high, 4x=xhigh
// Claude: 1x=high, 2x=max
// Gemini: 1x=low, 2x=high
type Provider = 'openai' | 'claude' | 'gemini'

const PROVIDER_VARIANTS: Record<Provider, readonly string[]> = {
  openai: ['low', 'medium', 'high', 'xhigh'],
  claude: ['high', 'max'],
  gemini: ['low', 'high'],
}

function detectProvider(modelId?: string): Provider {
  const id = modelId?.toLowerCase() ?? ''
  if (id.includes('claude')) return 'claude'
  if (id.includes('gemini')) return 'gemini'
  return 'openai'
}

const PROVIDER_DEFAULTS: Record<Provider, number> = {
  openai: 2, // 'high'
  claude: 0, // 'high'
  gemini: 1, // 'high'
}

function getReasoningConfig(modelId?: string) {
  const provider = detectProvider(modelId)
  const variants = PROVIDER_VARIANTS[provider]
  return {
    variants,
    maxLevel: variants.length - 1,
    defaultLevel: PROVIDER_DEFAULTS[provider],
  }
}

type InputMenuProps = {
  onUploadClick: () => void
  uploadDisabled?: boolean
}

function InputMenu({ onUploadClick, uploadDisabled }: InputMenuProps) {
  const [open, setOpen] = useState(false)
  const { data: mcpStatus, isLoading } = useMcpStatusQuery(open)
  const totalCount = mcpStatus ? Object.keys(mcpStatus).length : 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="size-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <Sliders className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-52 p-0">
        {/* Upload file */}
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploadDisabled}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Paperclip className="size-4 text-muted-foreground" />
          <span>Upload file</span>
        </button>

        {/* MCP Servers */}
        <div className="border-t">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Plug className="size-3.5" />
            <span>MCP</span>
          </div>
          {isLoading ? (
            <div className="px-3 pb-2 text-xs text-muted-foreground">Loading...</div>
          ) : mcpStatus && totalCount > 0 ? (
            <div className="px-3 pb-2 space-y-1">
              {Object.entries(mcpStatus).map(([name, status]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      status.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                  />
                  <span className="capitalize">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 pb-2 text-xs text-muted-foreground">No servers</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function ChatInput({
  onSubmit,
  disabled,
  placeholder = 'Ask anything...',
  className,
  mode = 'orchestrator',
  onToggleMode,
  isWorking,
  onStop,
  isStopping,
  value: controlledValue,
  onValueChange,
  models = MODELS,
  selectedModel,
  onModelChange,
  subagents = [],
}: Props) {
  const [internalValue, setInternalValue] = useState('')
  const value = controlledValue ?? internalValue
  const setValue = onValueChange ?? setInternalValue
  const [attachments, setAttachments] = useState<UploadingAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedSubagent, setSelectedSubagent] = useState<string | undefined>()
  const [showSubagentDropdown, setShowSubagentDropdown] = useState(false)
  const [subagentFilter, setSubagentFilter] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isMax, setIsMax] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragCounter = useRef(0)

  // Find current selected model
  const currentModel = useMemo(() => {
    if (selectedModel) {
      return models.find(
        (m) => m.id === selectedModel.modelId && m.providerId === selectedModel.providerId,
      )
    }
    return models[0]
  }, [models, selectedModel])
  const reasoning = useMemo(() => getReasoningConfig(currentModel?.id), [currentModel?.id])
  const currentVariant = isMax
    ? reasoning.variants[reasoning.maxLevel]
    : reasoning.variants[reasoning.defaultLevel]

  useEffect(() => {
    // Reset max mode when model changes
    setIsMax(false)
  }, [currentModel?.id])

  const handleModelSelect = (modelId: string, providerId: string) => {
    onModelChange?.(modelId, providerId)
  }

  // Filter subagents based on @ mention
  const filteredSubagents = useMemo(() => {
    return subagents.filter((a) => a.name.toLowerCase().includes(subagentFilter.toLowerCase()))
  }, [subagents, subagentFilter])

  // Detect @ mention in input
  const atMatch = useMemo(() => value.match(/(?:^|\s)@(\w*)$/), [value])

  useEffect(() => {
    if (atMatch && subagents.length > 0) {
      setSubagentFilter(atMatch[1] || '')
      setShowSubagentDropdown(true)
      setHighlightedIndex(0)
    } else if (showSubagentDropdown) {
      setShowSubagentDropdown(false)
      setSubagentFilter('')
    }
  }, [atMatch, subagents.length, showSubagentDropdown])

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [value, resizeTextarea])

  const handleSubagentSelect = useCallback(
    (agent: Agent) => {
      // Replace @query with nothing and set the subagent
      const newValue = value.replace(/(?:^|\s)@\w*$/, '').trim()
      setValue(newValue)
      setSelectedSubagent(agent.name)
      setShowSubagentDropdown(false)
      setSubagentFilter('')
      textareaRef.current?.focus()
    },
    [value, setValue],
  )

  const addFiles = async (files: File[]) => {
    const valid = files
      .filter((f) => f.size <= MAX_FILE_SIZE)
      .slice(0, MAX_FILES - attachments.length)
    if (!valid.length) return

    const newAttachments: UploadingAttachment[] = await Promise.all(
      valid.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: file.type.startsWith('image/') ? await fileToDataUrl(file) : undefined,
        status: 'uploading' as const,
      })),
    )

    setAttachments((prev) => [...prev, ...newAttachments].slice(0, MAX_FILES))

    for (const attachment of newAttachments) {
      uploadFile(attachment.file)
        .then(({ url, size }) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachment.id ? { ...a, status: 'done', url, size } : a)),
          )
        })
        .catch(() => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachment.id ? { ...a, status: 'error' } : a)),
          )
        })
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addFiles(Array.from(e.target.files || []))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length) {
      e.preventDefault()
      addFiles(files)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (!isDragging && e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const hasUploading = attachments.some((a) => a.status === 'uploading')

  const handleSubmit = async () => {
    if ((!value.trim() && !attachments.length) || disabled || hasUploading) return

    const fileParts = attachmentsToParts(attachments)
    // Prepend @mention to text if subagent is selected
    const text = selectedSubagent ? `@${selectedSubagent} ${value.trim()}` : value.trim()

    setValue('')
    setAttachments([])
    setSelectedSubagent(undefined)
    const model = currentModel ?? models[0]
    if (!model) return
    onSubmit(
      text,
      fileParts.length ? fileParts : undefined,
      model.id,
      model.providerId,
      currentVariant,
      isMax,
    )
  }

  // Handle keyboard navigation in subagent dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Backspace at start of input clears selected subagent
    if (e.key === 'Backspace' && selectedSubagent && value === '') {
      e.preventDefault()
      setSelectedSubagent(undefined)
      return
    }

    if (showSubagentDropdown && filteredSubagents.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((i) => Math.min(i + 1, filteredSubagents.length - 1))
          return
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => Math.max(i - 1, 0))
          return
        case 'Tab':
        case 'Enter':
          if (filteredSubagents[highlightedIndex]) {
            e.preventDefault()
            handleSubagentSelect(filteredSubagents[highlightedIndex])
            return
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowSubagentDropdown(false)
          return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isWorking) handleSubmit()
    }
  }

  const canSubmit = !hasUploading && !disabled && (value.trim() || attachments.length)

  return (
    <div
      className={cn('w-full relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-brand bg-brand/10 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-medium text-brand">Drop files here</span>
        </div>
      )}
      <div
        className={cn(
          'rounded-2xl border bg-background shadow-lg overflow-hidden',
          isDragging ? 'border-brand' : 'border-border',
        )}
      >
        {/* File previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 p-3 pb-1 flex-wrap">
            {attachments.map((a) => (
              <div key={a.id} className="relative group">
                <div className="size-12 sm:size-14 rounded-xl overflow-hidden bg-muted border border-border">
                  {a.url || a.preview ? (
                    <img
                      src={a.url || a.preview}
                      alt={a.file.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <FileText className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  {a.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="size-5 text-white animate-spin" />
                    </div>
                  )}
                  {a.status === 'error' && (
                    <div className="absolute inset-0 bg-destructive/60 flex items-center justify-center">
                      <X className="size-5 text-white" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 flex items-center justify-center shadow-md border border-background"
                >
                  <X className="size-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Subagent dropdown */}
        {showSubagentDropdown && filteredSubagents.length > 0 && (
          <div className="absolute bottom-full left-3 mb-1 w-48 max-h-40 overflow-y-auto rounded border bg-popover shadow z-50">
            {filteredSubagents.map((agent, index) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => handleSubagentSelect(agent)}
                className={cn(
                  'w-full px-2 py-1 text-left text-xs',
                  index === highlightedIndex ? 'bg-accent' : '',
                )}
              >
                <span className="text-brand font-medium">@{agent.name}</span>
                {agent.description && (
                  <span className="text-muted-foreground ml-1.5">{agent.description}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Selected agent chip */}
        {selectedSubagent && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setSelectedSubagent(undefined)}
              className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[11px] font-medium bg-brand text-brand-foreground"
            >
              @{selectedSubagent}
              <X className="size-2.5" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className={cn('px-3 pb-1', selectedSubagent ? 'pt-2' : 'pt-4')}>
          <textarea
            ref={textareaRef}
            className="w-full resize-none outline-none text-sm min-h-[20px] max-h-48 bg-transparent"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html"
              onChange={handleFileSelect}
              className="hidden"
            />

            <InputMenu
              onUploadClick={() => fileInputRef.current?.click()}
              uploadDisabled={attachments.length >= MAX_FILES}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleMode}
                  className="h-8 px-2 flex items-center gap-2 rounded-lg text-xs font-medium hover:bg-muted/60"
                >
                  <span className="text-muted-foreground hidden sm:inline">Chat</span>
                  <div
                    className={cn(
                      'relative w-7 h-4 rounded-full',
                      mode === 'plan' ? 'bg-brand' : 'bg-muted-foreground/30',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 size-3 rounded-full bg-white shadow-sm',
                        mode === 'plan' ? 'translate-x-[14px]' : 'translate-x-0.5',
                      )}
                    />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {mode === 'plan' ? 'Chat only — no file changes' : 'Orchestrator — can edit files'}
              </TooltipContent>
            </Tooltip>

            <ModelSelectorDropdown
              models={models}
              selectedModel={selectedModel}
              onSelect={handleModelSelect}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsMax((v) => !v)}
                  className="h-8 px-2 flex items-center gap-2 rounded-lg text-xs font-medium hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      'italic font-bold tracking-wide transition-colors',
                      isMax ? 'text-brand' : 'text-muted-foreground',
                    )}
                  >
                    MAX
                  </span>
                  <div
                    className={cn(
                      'relative w-7 h-4 rounded-full transition-colors',
                      isMax ? 'bg-brand' : 'bg-muted-foreground/30',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-200',
                        isMax ? 'translate-x-[14px]' : 'translate-x-0.5',
                      )}
                    />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {isMax ? 'Max reasoning enabled' : 'Enable max reasoning'}
              </TooltipContent>
            </Tooltip>
          </div>

          {isWorking ? (
            <Button
              type="button"
              disabled={isStopping}
              onClick={onStop}
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-full text-danger hover:bg-danger hover:text-white"
            >
              <span className="size-2 rounded-full bg-current animate-pulse" />
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              size="sm"
              className="size-8 p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
