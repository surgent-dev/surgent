'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWhopConnect } from '@/queries/surpay'
import { parseConnectError } from './utils'
import { authClient } from '@/lib/auth-client'

interface WhopConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function WhopConnectDialog({ open, onOpenChange, onSuccess }: WhopConnectDialogProps) {
  const [companyName, setCompanyName] = useState('')
  const whopConnect = useWhopConnect()

  const handleCreate = async () => {
    if (!companyName.trim()) return
    let session
    try {
      session = await authClient.getSession()
    } catch {
      toast.error('Failed to get session')
      return
    }
    const email = session.data?.user?.email
    if (!email) {
      toast.error('Unable to get user email')
      return
    }
    try {
      await whopConnect.mutateAsync({
        data: { email, title: companyName.trim(), country: 'us' },
      })
      toast.success('Payment account connected')
      onOpenChange(false)
      setCompanyName('')
      onSuccess?.()
    } catch (err: any) {
      toast.error(parseConnectError(err, 'Failed to connect payment account'))
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (!isOpen) setCompanyName('')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Payment Account</DialogTitle>
          <DialogDescription>Enter your company name to get started</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && companyName.trim()) handleCreate()
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!companyName.trim() || whopConnect.isPending}>
            {whopConnect.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
