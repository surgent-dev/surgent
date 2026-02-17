import { useQuery } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'
import { usePayEnv } from '@/stores/pay-env'

export type TransactionType =
  | 'payment'
  | 'processor_fee'
  | 'refund'
  | 'dispute'
  | 'balance'
  | 'payout'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  currency: string
  createdAt: string
  succeededAt: string | null
  refundedAt: string | null
  customerId: string | null
  productId: string | null
  processor: string
}

export interface TransactionsResponse {
  transactions: Transaction[]
  total: number
  hasMore: boolean
}

async function fetchTransactions(projectId: string): Promise<TransactionsResponse> {
  const data = await payHttp
    .get(`project/${projectId}/transactions`, { searchParams: { projectId } })
    .json<Transaction[]>()
  return {
    transactions: data ?? [],
    total: data?.length ?? 0,
    hasMore: false,
  }
}

export function useTransactions(projectId?: string) {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['transactions', projectId, env],
    queryFn: () => fetchTransactions(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30,
  })
}
