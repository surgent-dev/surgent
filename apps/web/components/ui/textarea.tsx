import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full rounded-[14px] bg-black/10 px-4 py-3 text-[14px] field-sizing-content',
        'text-foreground placeholder:text-muted-foreground/60',
        'border border-transparent transition-all duration-200 outline-none',
        'shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.06)]',
        'hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-black/20',
        'focus:bg-black/40 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.15),0_0_0_3px_rgba(255,255,255,0.06)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.06)] disabled:hover:bg-black/10',
        'aria-invalid:border-destructive/50 aria-invalid:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)] aria-invalid:focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
