'use client'

import type { Agent } from '@opencode-ai/sdk'
import { Bot, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  subagents: Agent[]
  value: string
  onValueChange: (value: string) => void
  selectedSubagent?: string
  onSubagentSelect: (agentName: string | undefined) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

export default function SubagentMention({
  subagents,
  value,
  onValueChange,
  selectedSubagent,
  onSubagentSelect,
  inputRef,
}: Props) {
  const [dismissedMention, setDismissedMention] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mentionMatch = useMemo(() => value.match(/(?:^|\s)@(\w*)$/), [value])
  const filter = mentionMatch?.[1] || ''
  const mentionToken = mentionMatch?.[0]?.trim() ?? null
  const showDropdown = Boolean(mentionMatch) && dismissedMention !== mentionToken

  // Filter subagents based on input after @
  const filteredSubagents = subagents.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase()),
  )
  const activeIndex = Math.min(highlightedIndex, Math.max(filteredSubagents.length - 1, 0))

  const handleSelect = useCallback(
    (agent: Agent) => {
      // Replace the @query with @agentname
      const newValue = value.replace(/(?:^|\s)@\w*$/, '').trim()
      onValueChange(newValue)
      onSubagentSelect(agent.name)
      setDismissedMention(null)
      setHighlightedIndex(0)
      inputRef?.current?.focus()
    },
    [value, onValueChange, onSubagentSelect, inputRef],
  )

  const clearSubagent = () => {
    onSubagentSelect(undefined)
    inputRef?.current?.focus()
  }

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((i) => Math.min(i + 1, filteredSubagents.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
        case 'Tab':
          if (filteredSubagents[activeIndex]) {
            e.preventDefault()
            handleSelect(filteredSubagents[activeIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setDismissedMention(mentionToken)
          break
      }
    },
    [showDropdown, filteredSubagents, activeIndex, handleSelect, mentionToken],
  )

  // Expose keyboard handler
  useEffect(() => {
    const input = inputRef?.current
    if (!input) return

    const handler = (e: KeyboardEvent) => {
      handleKeyDown(e as unknown as React.KeyboardEvent)
    }

    input.addEventListener('keydown', handler)
    return () => input.removeEventListener('keydown', handler)
  }, [inputRef, handleKeyDown])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDismissedMention(mentionToken)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mentionToken])

  return (
    <>
      {/* Selected subagent badge */}
      {selectedSubagent && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-medium mr-2">
          <Bot className="size-3" />
          <span>@{selectedSubagent}</span>
          <button
            type="button"
            onClick={clearSubagent}
            className="p-0.5 hover:bg-brand/20 rounded-full transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Subagent dropdown */}
      {showDropdown && filteredSubagents.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto rounded-lg border bg-background shadow-lg z-50"
        >
          <div className="p-1">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Subagents
            </div>
            {filteredSubagents.map((agent, index) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => handleSelect(agent)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                  index === activeIndex ? 'bg-muted' : 'hover:bg-muted/50',
                )}
              >
                <Bot className="size-4 shrink-0" style={{ color: agent.color || undefined }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">@{agent.name}</span>
                  {agent.description && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {agent.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
