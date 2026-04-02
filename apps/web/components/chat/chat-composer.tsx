'use client'

import { ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import { cn } from '@/lib/utils'

type ChatComposerProps = {
  onSend: (text: string, files?: FileList, projectType?: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  buttonClassName?: string
  value?: string
  onValueChange?: (value: string) => void
}

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = 'Type a message…',
  className,
  buttonClassName,
  value: controlledValue,
  onValueChange,
}: ChatComposerProps) {
  const [internalValue, setInternalValue] = useState('')
  const value = controlledValue !== undefined ? controlledValue : internalValue
  const setValue = onValueChange || setInternalValue

  const handleSend = () => {
    const text = value.trim()
    if (disabled || !text) return
    onSend(text, undefined, 'simple')
    setValue('')
  }

  return (
    <div className={cn('w-full', className)}>
      <PromptInput value={value} onValueChange={setValue} onSubmit={handleSend} className="w-full">
        <PromptInputTextarea
          id="chat-message-input"
          placeholder={placeholder}
          className={cn(
            'min-h-[44px] sm:min-h-[48px] max-h-[150px] sm:max-h-[200px] overflow-hidden',
            'text-sm sm:text-[16px] leading-6 sm:leading-7 placeholder:text-foreground/40',
            'px-0.5 sm:px-1',
          )}
        />

        <PromptInputActions className="pt-1.5 sm:pt-2">
          <div className="ml-auto">
            <PromptInputAction tooltip={disabled || !value.trim() ? 'Type a message' : 'Send'}>
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className={cn(
                  'h-7 w-7 sm:h-8 sm:w-8 rounded-full btn-brand transition-all duration-100',
                  disabled || !value.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  buttonClassName,
                )}
              >
                <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </PromptInputAction>
          </div>
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}
