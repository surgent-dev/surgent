'use client'

import { useId } from 'react'

interface SparklineProps {
  data: { y: number }[]
  className?: string
}

export function Sparkline({ data, className }: SparklineProps) {
  const id = useId().replace(/:/g, '')
  if (!data.length) return null

  const values = data.map((d) => d.y)
  const series = values.length === 1 ? [values[0]!, values[0]!] : values
  const W = 240
  const H = 72
  const PX = 8
  const PY = 8
  const innerW = W - PX * 2
  const innerH = H - PY * 2
  const min = Math.min(...series)
  const max = Math.max(...series)
  const flat = min === max
  const baseY = H - PY - 4
  const midY = PY + innerH * 0.58

  const pts = series.map((v, i) => ({
    x: PX + (innerW * i) / Math.max(series.length - 1, 1),
    y: flat ? (v === 0 ? baseY : midY) : PY + (1 - (v - min) / (max - min)) * innerH,
  }))

  let line = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const curr = pts[i]!
    const cx = (prev.x + curr.x) / 2
    line += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`
  }

  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const area = `${line} L ${last.x} ${H} L ${first.x} ${H} Z`

  return (
    <svg
      aria-hidden="true"
      className={className ?? 'size-full'}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ color: 'var(--color-brand)' }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.16} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
