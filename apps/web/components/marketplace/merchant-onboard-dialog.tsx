'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnboardMerchant } from '@/queries/marketplace'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

interface MerchantOnboardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultEmail?: string
}

export function MerchantOnboardDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultEmail,
}: MerchantOnboardDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState(defaultEmail ?? '')
  const onboard = useOnboardMerchant()

  useEffect(() => {
    if (open && defaultEmail) setEmail(defaultEmail)
  }, [open, defaultEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      await onboard.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        createWhopCompany: true,
      })
      toast.success('Merchant account created!')
      setName('')
      setEmail('')
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create merchant')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Become a Seller</DialogTitle>
          <DialogDescription>
            Set up your merchant account to start selling.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Business Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your business name"
              className="h-9"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={defaultEmail || 'your@email.com'}
              className="h-9"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || onboard.isPending}>
              {onboard.isPending && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
