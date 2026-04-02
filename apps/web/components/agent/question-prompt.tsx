'use client'

import { useState } from 'react'
import type { QuestionAnswer, QuestionRequest } from '@/lib/question'
import { cn } from '@/lib/utils'

type Props = {
  request: QuestionRequest
  onReply: (answers: QuestionAnswer[]) => void
  onReject: () => void
  pending?: boolean
}

export default function QuestionPrompt({ request, onReply, onReject, pending }: Props) {
  const qs = request.questions
  const [picked, setPicked] = useState<string[][]>(() => qs.map(() => []))
  const [custom, setCustom] = useState<string[]>(() => qs.map(() => ''))

  if (!qs.length) return null

  const pick = (idx: number, label: string) => {
    const q = qs[idx]
    if (!q) return
    setPicked((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p
        if (q.multiple) {
          if (p.includes(label)) return p.filter((x) => x !== label)
          return [...p, label]
        }
        return [label]
      }),
    )
  }

  const updateCustom = (idx: number, value: string) => {
    setCustom((prev) => prev.map((c, i) => (i === idx ? value : c)))
  }

  const addCustom = (idx: number) => {
    const value = custom[idx]?.trim()
    if (!value) return
    const q = qs[idx]
    if (!q) return
    setPicked((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p
        if (q.multiple) {
          if (p.includes(value)) return p
          return [...p, value]
        }
        return [value]
      }),
    )
    setCustom((prev) => prev.map((c, i) => (i === idx ? '' : c)))
  }

  const buildAnswers = (): QuestionAnswer[] =>
    qs.map((q, i) => {
      const base = picked[i] ?? []
      const extra = custom[i]?.trim()
      if (!extra) return base
      if (q.multiple) {
        if (base.includes(extra)) return base
        return [...base, extra]
      }
      return [extra]
    })

  const answers = buildAnswers()
  const canSend = answers.length > 0 && answers.every((a) => a.length > 0)

  return (
    <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
      {qs.map((q, idx) => (
        <div key={`${request.id}_${idx}`} className="space-y-2">
          <p className="text-sm font-medium">{q.question}</p>

          <div className="space-y-1">
            {q.options.map((o) => (
              <button
                key={o.label}
                onClick={() => pick(idx, o.label)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded text-sm border',
                  picked[idx]?.includes(o.label)
                    ? 'bg-brand/10 border-brand'
                    : 'bg-background border-transparent hover:border-border',
                )}
              >
                {o.label}
                {o.description && (
                  <span className="text-muted-foreground ml-2 text-xs">{o.description}</span>
                )}
              </button>
            ))}

            {q.custom !== false && (
              <input
                value={custom[idx] ?? ''}
                onChange={(e) => updateCustom(idx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  addCustom(idx)
                }}
                placeholder="Other..."
                className="w-full px-3 py-2 text-sm rounded border bg-background focus:outline-none focus:border-brand"
              />
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => onReply(answers)}
          disabled={!canSend || pending}
          className="flex-1 h-8 text-sm font-medium rounded btn-brand disabled:opacity-40"
        >
          {pending ? 'Sending...' : 'Send'}
        </button>
        <button
          onClick={onReject}
          disabled={pending}
          className="px-3 h-8 text-sm rounded border hover:bg-muted"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
