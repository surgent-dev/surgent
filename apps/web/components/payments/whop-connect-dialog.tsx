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

  const showConnectError = (err: any, fallback: string) => {
    const msg = err?.message || ''
    if (msg.includes('PROCESSOR_ALREADY_CONNECTED')) {
      const processor = msg.split(':')[1] || 'another provider'
      toast.error(`This project already has ${processor} connected`)
    } else {
      toast.error(fallback)
    }
  }

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
      toast.success('Whop connected')
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      showConnectError(err, 'Failed to connect Whop')
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
      toast.success('Whop connected')
      onOpenChange(false)
      setCompanyName('')
      onSuccess?.()
    } catch (err: any) {
      showConnectError(err, 'Failed to connect Whop')
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
              <DialogTitle>Create Whop Account</DialogTitle>
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
              <DialogTitle>Connect Whop</DialogTitle>
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
                      <div className="size-8 rounded-md bg-[#FF6243] grid place-items-center shrink-0">
                        <Image
                          src="/whop_logo_brandmark_orange.svg"
                          alt="Whop"
                          width={18}
                          height={9}
                          className="brightness-0 invert"
                        />
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
