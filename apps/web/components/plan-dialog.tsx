'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PricingTable } from 'autumn-js/react'

interface PlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PlanDialog({ open, onOpenChange }: PlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Choose a Plan</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-4">
          <PricingTable />
        </div>
      </DialogContent>
    </Dialog>
  )
}
