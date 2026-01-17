'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface DeployDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName?: string
  onConfirm: (sanitizedName: string) => Promise<void> | void
  isSubmitting?: boolean
  intent?: 'deploy' | 'hostname'
}

export default function DeployDialog({
  open,
  onOpenChange,
  defaultName,
  onConfirm,
  isSubmitting,
  intent = 'deploy',
}: DeployDialogProps) {
  const [deployName, setDeployName] = useState<string>(defaultName || '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingName, setPendingName] = useState<string | null>(null)

  const isHostnameChange = intent === 'hostname'
  const showHostnameInput = isHostnameChange || !defaultName
  const dialogTitle = isHostnameChange ? 'Change hostname' : 'Publish your app'
  const dialogDescription = isHostnameChange
    ? 'Update the subdomain for your deployment.'
    : showHostnameInput
      ? 'Choose a unique subdomain. Your app will be available at this URL.'
      : 'Deploy using your existing hostname.'
  const actionLabel = isHostnameChange ? 'Save' : 'Deploy'

  useEffect(() => {
    if (!open) return
    if (showHostnameInput) {
      setDeployName(defaultName || '')
    }
    setNameError(null)
    setConfirmOpen(false)
    setPendingName(null)
  }, [open, defaultName, showHostnameInput])

  const sanitize = (value: string) => {
    const lower = value.toLowerCase()
    const replaced = lower.replace(/[^a-z0-9-]+/g, '-')
    const collapsed = replaced.replace(/-+/g, '-')
    const trimmed = collapsed.replace(/^-+|-+$/g, '')
    return trimmed.slice(0, 63)
  }

  const previewDomain = useMemo(() => {
    const sanitized = sanitize(deployName || '')
    return sanitized ? `${sanitized}.surgent.site` : 'your-app.surgent.site'
  }, [deployName])

  const handleConfirm = () => {
    const sanitized = sanitize(deployName)
    if (!sanitized) {
      setNameError('Please enter a valid name.')
      return
    }
    setNameError(null)
    if (isHostnameChange) {
      const current = defaultName ? sanitize(defaultName) : ''
      if (sanitized !== current) {
        setPendingName(sanitized)
        setConfirmOpen(true)
        return
      }
    }
    onConfirm(sanitized)
  }

  const handleFinalConfirm = async () => {
    if (!pendingName) return
    await onConfirm(pendingName)
    setConfirmOpen(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center">
              <Input
                className="rounded-r-none"
                placeholder="my-app"
                value={deployName}
                onChange={(e) => setDeployName(e.target.value)}
                onBlur={() => setDeployName(sanitize(deployName))}
                disabled={Boolean(isSubmitting)}
              />
              <div className="h-9 px-3 flex items-center border border-input border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground whitespace-nowrap">
                .surgent.site
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Will be published as: {previewDomain}</div>
            {nameError ? <div className="text-xs text-danger">{nameError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={Boolean(isSubmitting)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleConfirm} disabled={Boolean(isSubmitting)}>
              {isSubmitting ? 'Saving…' : actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm hostname change</DialogTitle>
            <DialogDescription>You are about to change the public URL for this deployment. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={Boolean(isSubmitting)}>
              No
            </Button>
            <Button onClick={handleFinalConfirm} disabled={Boolean(isSubmitting)}>
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
