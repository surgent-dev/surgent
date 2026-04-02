'use client'

import { CircleNotch } from '@phosphor-icons/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSandbox } from '@/hooks/use-sandbox'
import { useSurpayConnect } from '@/queries/surpay'

interface PayDialogsProps {
  projectId?: string
}

export default function PayDialogs({ projectId }: PayDialogsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const setPulsePaymentsTab = useSandbox((s) => s.setPulsePaymentsTab)
  const surpayConnect = useSurpayConnect()

  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isConflictOpen, setIsConflictOpen] = useState(false)

  // Pay success handling
  useEffect(() => {
    if (searchParams.get('pay_connected') === 'true') {
      const timer = window.setTimeout(() => setIsSuccessOpen(true), 0)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('pay_connected')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
      return () => window.clearTimeout(timer)
    }
  }, [searchParams, pathname, router])

  // Pay conflict handling
  useEffect(() => {
    if (searchParams.get('pay_conflict') === 'true') {
      const accountId = searchParams.get('conflict_account_id')
      if (accountId) {
        const timer = window.setTimeout(() => setIsConflictOpen(true), 0)
        const params = new URLSearchParams(searchParams.toString())
        params.delete('pay_conflict')
        params.delete('conflict_account_id')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
        return () => window.clearTimeout(timer)
      }
    }
  }, [searchParams, pathname, router])

  const dismissSuccess = () => {
    setIsSuccessOpen(false)
    setPulsePaymentsTab(true)
    setTimeout(() => setPulsePaymentsTab(false), 10000)
  }

  return (
    <>
      <Dialog
        open={isSuccessOpen}
        onOpenChange={(open) => {
          setIsSuccessOpen(open)
          if (!open) {
            setPulsePaymentsTab(true)
            setTimeout(() => setPulsePaymentsTab(false), 10000)
          }
        }}
      >
        <DialogContent overlayClassName="backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Payment Account Connected!</DialogTitle>
            <DialogDescription>
              You can now head to the Payments tab to configure pricing and more.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissSuccess}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConflictOpen} onOpenChange={setIsConflictOpen}>
        <DialogContent overlayClassName="backdrop-blur-sm" className="sm:max-w-lg">
          <div className="flex flex-col items-center text-center pt-12 pb-2">
            <div className="relative flex items-center justify-center mb-14">
              <div className="absolute size-28 rounded-full bg-foreground/5" />
              <div className="absolute size-20 rounded-full bg-foreground/10" />
              <div className="relative size-12 rounded-full bg-foreground/15 border-2 border-foreground/20 flex items-center justify-center">
                <span className="text-foreground text-xl font-semibold">i</span>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-3">Move this payment account?</h2>
            <p className="text-sm text-muted-foreground mb-10">
              This payment account is currently connected to another project.
              <br />
              You can move it here, or use a different account instead.
            </p>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 h-10"
                disabled={surpayConnect.isPending}
                onClick={() => {
                  if (!projectId) return
                  surpayConnect.mutate(projectId, {
                    onSuccess: (data) => {
                      setIsConflictOpen(false)
                      window.location.href = data.oauthUrl
                    },
                    onError: () => toast.error('Failed to start payment connection', {}),
                  })
                }}
              >
                {surpayConnect.isPending && <CircleNotch className="size-4 animate-spin mr-1.5" />}
                Use Different Account
              </Button>
              <Button
                className="flex-1 h-10"
                variant="outline"
                onClick={() => {
                  setIsConflictOpen(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
