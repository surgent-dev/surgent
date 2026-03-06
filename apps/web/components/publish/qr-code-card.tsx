'use client'

import { useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { DownloadSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface QrCodeCardProps {
  url: string
  size?: number
}

export function QrCodeCard({ url, size = 120 }: QrCodeCardProps) {
  const svgRef = useRef<HTMLDivElement>(null)

  const handleDownload = useCallback(() => {
    const svg = svgRef.current?.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = size * scale
    canvas.height = size * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const link = document.createElement('a')
      link.download = 'qr-code.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }, [size])

  return (
    <div className="flex items-center gap-4">
      <div ref={svgRef} className="rounded-lg border bg-white p-2 shrink-0">
        <QRCodeSVG value={url} size={size} level="M" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Scan to open on mobile</p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <DownloadSimple className="size-3.5" weight="bold" />
          Download QR
        </Button>
      </div>
    </div>
  )
}
