'use client'

import { cn } from '@/lib/utils'
import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        'not-prose flex w-full min-w-0 flex-col overflow-hidden border',
        'border-border bg-card text-card-foreground rounded-xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({ code, language = 'tsx', className, style, ...props }: CodeBlockCodeProps) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto font-mono',
        '[&>pre]:p-3 [&_pre]:font-mono [&_pre]:text-inherit! [&_code]:text-inherit!',
        className,
      )}
      style={{
        ...style,
        fontSize: 'clamp(10px, 1.8vw, 13px)',
        lineHeight: 1.5,
      }}
      {...props}
    >
      <SyntaxHighlighter
        language={language}
        customStyle={{ margin: 0, background: 'transparent' }}
        codeTagProps={{ style: { fontFamily: 'inherit' } }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export { CodeBlock, CodeBlockCode }
