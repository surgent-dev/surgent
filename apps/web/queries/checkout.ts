import { useQuery } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'

export interface CheckoutSession {
  id: string
  sessionId: string | null
  status: 'creating' | 'open' | 'completed' | 'failed' | 'pending'
  amount: number | null
  currency: string | null
  planType: string | null
  title: string | null
  redirectUrl: string | null
  env: 'test' | 'live'
  createdAt: string
  completedAt: string | null
}

const MAX_POLL_MS = 10 * 60 * 1000 // stop polling after 10 minutes

export function useCheckoutSession(id: string | undefined) {
  return useQuery({
    queryKey: ['checkout', id],
    queryFn: () => payHttp.get(`checkout/${id}`).json<CheckoutSession>(),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'open' || status === 'creating' || status === 'pending') {
        const createdAt = query.state.data?.createdAt
        if (createdAt && Date.now() - new Date(createdAt).getTime() > MAX_POLL_MS) return false
        return 3000
      }
      return false
    },
  })
}
