import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'
import { usePayEnv } from '@/stores/pay-env'

export interface Subscription {
  id: string
  projectId: string | null
  productId: string | null
  productPriceId: string | null
  customerId: string | null
  processorSubscriptionId: string
  processorCustomerId: string | null
  createdAt: string
  deletedAt: null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  endedAt: string | null
  status: string
}

async function fetchSubscriptions(projectId: string): Promise<Subscription[]> {
  const data = await payHttp
    .get('subscriptions', { searchParams: { projectId } })
    .json<Subscription[]>()
  return data ?? []
}

export function useSubscriptions(projectId?: string) {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['subscriptions', projectId, env],
    queryFn: () => fetchSubscriptions(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30,
  })
}

export function useCancelSubscription(projectId?: string) {
  const env = usePayEnv((s) => s.env)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      return payHttp
        .post(`subscriptions/${subscriptionId}/cancel`, {
          searchParams: projectId ? { projectId } : {},
        })
        .json<{ id: string; status: string; canceledAt: string }>()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', projectId, env] })
    },
  })
}
