'use client'

import { useState } from 'react'
import { Copy, Check, XLogo, LinkedinLogo } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface ShareButtonsProps {
  url: string
}

export function ShareButtons({ url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareText = 'Check out what I built!'

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
        {copied ? (
          <Check className="size-3.5 text-emerald-500" weight="bold" />
        ) : (
          <Copy className="size-3.5" weight="bold" />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Button variant="outline" size="icon-sm" asChild>
        <a
          href={`https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
        >
          <XLogo className="size-3.5" weight="bold" />
        </a>
      </Button>
      <Button variant="outline" size="icon-sm" asChild>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
        >
          <LinkedinLogo className="size-3.5" weight="bold" />
        </a>
      </Button>
    </div>
  )
}
