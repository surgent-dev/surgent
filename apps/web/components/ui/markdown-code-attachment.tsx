'use client'

import type { Element } from 'hast'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type Props = React.HTMLAttributes<HTMLElement> & { node?: Element }

export function MarkdownCodeAttachment({ className, children, node, ...props }: Props) {
  const [copied, setCopied] = useState(false)
  const code = typeof children === 'string' ? children : String(children ?? '')
  const lang = className?.replace('language-', '') ?? ''
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Inline code: same line start/end
  const pos = node?.position
  if (pos?.start?.line === pos?.end?.line) {
    return (
      <code
        className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-sm', className)}
        {...props}
      >
        {children}
      </code>
    )
  }

  return (
    <div className="not-prose my-2 rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex h-8 items-center justify-between border-b bg-muted/40 px-3">
        <span className="font-mono text-[11px] text-muted-foreground">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}
