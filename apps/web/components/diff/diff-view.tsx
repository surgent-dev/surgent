'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { EditorState, Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { unifiedMergeView, presentableDiff } from '@codemirror/merge'
import { javascript } from '@codemirror/lang-javascript'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from 'next-themes'

type Props = {
  before: string
  after: string
  path?: string
  className?: string
  collapseUnchanged?: boolean
  contextLines?: number
}

const RED = { dark: '251, 113, 133', light: '225, 29, 72' }
const GREEN = { dark: '34, 197, 94', light: '22, 163, 74' }

function diffTheme(dark: boolean) {
  const r = dark ? RED.dark : RED.light
  const g = dark ? GREEN.dark : GREEN.light

  return EditorView.theme(
    {
      '&': {
        backgroundColor: dark ? '#0d1117' : '#ffffff',
        color: dark ? '#e6edf3' : '#0a2540',
        fontSize: '13px',
        lineHeight: '1.5',
      },
      '.cm-scroller': { overflowX: 'auto', overflowY: 'visible' },
      '.cm-gutters': {
        backgroundColor: dark ? '#0d1117' : '#f8fafc',
        color: dark ? '#636e7b' : '#64748b',
        border: 'none',
      },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
      '.cm-content': { padding: '12px 0' },

      // Deleted lines + chunks
      '&.cm-merge-a .cm-changedLine, .cm-deletedChunk': {
        backgroundColor: dark ? '#2a1519' : `rgba(${r}, 0.08)`,
      },
      '&.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText': {
        background: 'none',
        backgroundColor: dark ? '#4a2328' : `rgba(${r}, 0.14)`,
        borderRadius: '2px',
      },
      '&.cm-merge-a .cm-changedLineGutter, & .cm-deletedLineGutter': {
        backgroundColor: dark ? '#321a1e' : `rgba(${r}, 0.18)`,
        ...(dark && { color: '#c9616a' }),
      },

      // Added lines
      '&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine': {
        backgroundColor: dark ? '#132519' : `rgba(${g}, 0.08)`,
      },
      '&.cm-merge-b .cm-changedText': {
        background: 'none',
        backgroundColor: dark ? '#1a4a2a' : `rgba(${g}, 0.16)`,
        borderRadius: '2px',
      },
      '&.cm-merge-b .cm-changedLineGutter': {
        backgroundColor: dark ? '#182b1e' : `rgba(${g}, 0.2)`,
        ...(dark && { color: '#5dba6e' }),
      },

      // Deleted text shown inside the "after" panel
      '&.cm-merge-b .cm-deletedText': {
        backgroundColor: dark ? '#4a2328' : `rgba(${r}, 0.14)`,
        borderRadius: '2px',
      },

      // Strip default decorations
      '.cm-insertedLine, .cm-deletedLine, .cm-deletedLine del': {
        textDecoration: 'none',
      },
    },
    { dark },
  )
}

export default function DiffView({
  before,
  after,
  path,
  className,
  collapseUnchanged = false,
  contextLines = 3,
}: Props) {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const dark = resolvedTheme === 'dark'

  const extensions = useMemo(() => {
    const isJsTs = /\.(tsx?|jsx?)$/i.test(path || '')
    const exts: Extension[] = [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
      }),
      dark ? oneDark : syntaxHighlighting(defaultHighlightStyle),
      diffTheme(dark),
    ]
    if (isJsTs) exts.push(javascript({ typescript: true, jsx: true }))
    return exts
  }, [path, dark])

  const counts = useMemo(() => {
    try {
      const changes = presentableDiff(before, after)
      let add = 0,
        del = 0
      for (const ch of changes) {
        if (ch.toA > ch.fromA) del += before.slice(ch.fromA, ch.toA).split('\n').length
        if (ch.toB > ch.fromB) add += after.slice(ch.fromB, ch.toB).split('\n').length
      }
      return { add, del }
    } catch {
      return { add: 0, del: 0 }
    }
  }, [before, after])

  useEffect(() => {
    if (!containerRef.current) return
    viewRef.current?.destroy()

    const mergeConfig: Parameters<typeof unifiedMergeView>[0] = {
      original: before,
      gutter: true,
      highlightChanges: true,
      allowInlineDiffs: false,
      mergeControls: false,
    }

    if (collapseUnchanged) {
      mergeConfig.collapseUnchanged = {
        margin: Math.max(0, contextLines),
        minSize: 6,
      }
    }

    viewRef.current = new EditorView({
      parent: containerRef.current,
      doc: after,
      extensions: [...extensions, unifiedMergeView(mergeConfig)],
    })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [before, after, extensions, collapseUnchanged, contextLines])

  return (
    <div className={className}>
      <div className="rounded-lg border overflow-hidden bg-card">
        {path && (
          <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2 bg-muted">
            <span className="text-xs text-muted-foreground truncate font-mono">{path}</span>
            {(counts.add > 0 || counts.del > 0) && (
              <div className="flex items-center gap-1.5 text-[10px] tabular-nums">
                {counts.del > 0 && <span className="text-diff-del">-{counts.del}</span>}
                {counts.add > 0 && <span className="text-diff-add">+{counts.add}</span>}
              </div>
            )}
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  )
}
