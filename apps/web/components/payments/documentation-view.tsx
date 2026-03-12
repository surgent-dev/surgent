'use client'

import { FileText } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { paymentsDocumentation } from './documentation-content'

export function DocumentationView() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-[1080px] p-5 space-y-5">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg border bg-muted/30 grid place-items-center shrink-0">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Payments documentation</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Updated {paymentsDocumentation.updatedAt}. {paymentsDocumentation.intro}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {paymentsDocumentation.sections.map((section) => (
            <div key={section.title} className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 leading-6">
                      <span className="mt-[9px] size-1 rounded-full bg-border shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
