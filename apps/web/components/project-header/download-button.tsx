'use client'

import { CircleNotch, DownloadSimple } from '@phosphor-icons/react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCredits } from '@/hooks/use-credits'
import { http } from '@/lib/http'

interface DownloadButtonProps {
  projectId?: string
  projectName?: string
}

export default function DownloadButton({ projectId, projectName }: DownloadButtonProps) {
  const credits = useCredits()
  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!projectId || downloading) return
    setDownloading(true)
    try {
      const response = await http.get(`api/projects/${projectId}/download`, { timeout: 120000 })
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] || `${projectName || 'project'}.tar.gz`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        credits.openBalanceDialog()
      } else {
        toast.error(err instanceof Error ? err.message : 'Download failed')
      }
    } finally {
      setDownloading(false)
    }
  }, [projectId, downloading, projectName, credits])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownload}
          disabled={downloading || !projectId}
        >
          {downloading ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <DownloadSimple className="size-4" weight="bold" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Download project</TooltipContent>
    </Tooltip>
  )
}
