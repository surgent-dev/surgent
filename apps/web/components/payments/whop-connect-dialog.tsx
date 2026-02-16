'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus } from 'lucide-react'
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
import { useWhopConnect, useUserWhopAccounts, type UserSurpayAccount } from '@/queries/surpay'
import { parseConnectError } from './utils'
import { authClient } from '@/lib/auth-client'

interface WhopConnectDialogProps {
  projectId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function WhopConnectDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: WhopConnectDialogProps) {
  const [view, setView] = useState<'select' | 'create'>('select')
  const [companyName, setCompanyName] = useState('')

  const whopConnect = useWhopConnect()
  const userWhopAccounts = useUserWhopAccounts()

  const disconnectedAccounts = (userWhopAccounts.data ?? []).filter(
    (a) => a.status === 'disconnected' && a.projectId === null,
  )

  const handleReconnect = async (account: UserSurpayAccount) => {
    if (!projectId) return
    try {
      await whopConnect.mutateAsync({
        projectId,
        accountId: account.id,
        data: {
          email: account.email || '',
          title: account.title || '',
          country: account.country || 'us',
        },
      })
      toast.success('Payment account connected')
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      toast.error(parseConnectError(err, 'Failed to connect payment account'))
    }
  }

  const handleCreate = async () => {
    if (!projectId || !companyName.trim()) return
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
        projectId,
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
    if (!isOpen) {
      setView('select')
      setCompanyName('')
    }
  }

  // If no disconnected accounts, show create view directly
  const showCreate = view === 'create' || disconnectedAccounts.length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {showCreate ? (
          <>
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
              {disconnectedAccounts.length > 0 && (
                <Button variant="ghost" onClick={() => setView('select')} className="mr-auto">
                  Back
                </Button>
              )}
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!companyName.trim() || whopConnect.isPending}
              >
                {whopConnect.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Connect Payment Account</DialogTitle>
              <DialogDescription>Select an existing account or create new</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {userWhopAccounts.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <span className="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {disconnectedAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleReconnect(account)}
                      disabled={whopConnect.isPending}
                      className="flex items-center gap-3 w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <div className="size-8 rounded-md border bg-muted/40 grid place-items-center shrink-0">
                        <Image src="/surpay-coin.svg" alt="Surgent" width={20} height={20} />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {account.title || 'Untitled'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[account.email, account.country?.toUpperCase()]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setView('create')}
                    className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors"
                  >
                    <div className="size-8 rounded-md bg-muted grid place-items-center shrink-0">
                      <Plus className="size-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm text-muted-foreground">Create new account</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
