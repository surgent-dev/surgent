'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { fireConfetti } from '@/lib/confetti'
import { useBillingSync } from '@/hooks/use-subscription'

function getToastMessage(kind: 'subscription' | 'topup' | null, billing: string) {
  if (billing === 'return') return 'Billing synced'
  if (kind === 'subscription') return 'Pro subscription activated'
  if (kind === 'topup') return 'Usage balance added'
  return 'Billing updated successfully'
}

function BillingSyncEffect() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sync = useBillingSync()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    const billing = searchParams.get('billing')
    const sessionId = searchParams.get('session_id')
    if (!billing || (billing !== 'success' && billing !== 'return')) return

    const key = `${billing}:${sessionId ?? ''}`
    if (handled.current === key) return
    handled.current = key

    const clear = () => {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('billing')
      next.delete('session_id')
      const search = next.toString()
      const hash = window.location.hash
      router.replace(search ? `${pathname}?${search}${hash}` : `${pathname}${hash}`, {
        scroll: false,
      })
    }

    void sync
      .mutateAsync(sessionId)
      .then(({ kind }) => {
        toast.success(getToastMessage(kind, billing), { position: 'top-right' })
        if (billing === 'success') {
          void fireConfetti()
        }
      })
      .catch(() => {
        toast.error('Unable to sync billing state', { position: 'top-right' })
      })
      .finally(clear)
  }, [pathname, router, searchParams, sync])

  return null
}

export default function BillingSyncBridge() {
  return (
    <Suspense fallback={null}>
      <BillingSyncEffect />
    </Suspense>
  )
}
