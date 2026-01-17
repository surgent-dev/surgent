'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface HostnameChangeConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalHostname: string
  newHostname: string
  onConfirm: () => void
}

export default function HostnameChangeConfirmDialog({
  open,
  onOpenChange,
  originalHostname,
  newHostname,
  onConfirm,
}: HostnameChangeConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Hostname Change</DialogTitle>
          <DialogDescription>
            Are you sure that you want to change your hostname from "{originalHostname}" to "{newHostname}"?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            No
          </Button>
          <Button onClick={handleConfirm}>Yes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
