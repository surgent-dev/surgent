'use client'

import { useEffect, useRef } from 'react'
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

export default function BillingSyncBridge() {
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

    sync.mutate(sessionId, {
      onSuccess: async ({ kind }) => {
        toast.success(getToastMessage(kind, billing), { position: 'top-right' })
        if (billing === 'success') {
          void fireConfetti()
        }

        const next = new URLSearchParams(searchParams.toString())
        next.delete('billing')
        next.delete('session_id')
        const url = next.toString() ? `${pathname}?${next.toString()}` : pathname
        router.replace(url, { scroll: false })
      },
      onError: () => {
        toast.error('Unable to sync billing state', { position: 'top-right' })
      },
    })
  }, [pathname, router, searchParams, sync])

  return null
}
