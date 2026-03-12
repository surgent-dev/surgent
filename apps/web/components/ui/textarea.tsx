import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full rounded-xl px-4 py-3 text-[14px] field-sizing-content',
        'text-foreground placeholder:text-muted-foreground/60',
        'bg-black/[0.03] border border-black/[0.08] transition-all duration-150 outline-none',
        'hover:bg-black/[0.05] hover:border-black/[0.12]',
        'focus:bg-black/[0.05] focus:border-black/[0.16] focus:ring-2 focus:ring-black/[0.04]',
        'dark:bg-white/[0.04] dark:border-white/[0.08]',
        'dark:hover:bg-white/[0.06] dark:hover:border-white/[0.14]',
        'dark:focus:bg-white/[0.07] dark:focus:border-white/[0.18] dark:focus:ring-white/[0.06]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive/50 aria-invalid:focus:ring-destructive/15',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
