'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type ChartConfig = Record<string, { label: string; color: string }>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used within ChartContainer')
  return ctx
}

interface ChartContainerProps extends React.ComponentProps<'div'> {
  config: ChartConfig
}

function ChartContainer({ config, className, children, ...props }: ChartContainerProps) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn('flex aspect-video justify-center text-xs', className)}
        style={
          {
            ...Object.entries(config).reduce(
              (acc, [key, value]) => ({ ...acc, [`--color-${key}`]: value.color }),
              {},
            ),
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
}

interface ChartTooltipContentProps extends React.ComponentProps<'div'> {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: Record<string, unknown> }>
  label?: string
  labelKey?: string
  nameKey?: string
  hideLabel?: boolean
}

function ChartTooltipContent({
  active,
  payload,
  label,
  labelKey,
  nameKey,
  hideLabel = false,
  className,
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  const item = payload[0]
  const labelValue = labelKey ? item?.payload?.[labelKey] : undefined
  const tooltipLabel = labelValue === undefined || labelValue === null ? label : String(labelValue)

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {!hideLabel && tooltipLabel && <div className="font-medium">{tooltipLabel}</div>}
      <div className="grid gap-1.5">
        {payload.map((item, idx) => {
          const nameValue = nameKey ? item.payload?.[nameKey] : undefined
          const key = nameValue === undefined || nameValue === null ? item.name : String(nameValue)
          const conf = config[key]
          return (
            <div key={idx} className="flex w-full items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: conf?.color || 'var(--color-primary)' }}
              />
              <div className="flex flex-1 justify-between leading-none">
                <span className="text-muted-foreground">{conf?.label || key}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {item.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltipContent, useChart }
export type { ChartConfig }
