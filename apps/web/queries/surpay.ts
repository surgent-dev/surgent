import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'

// Types
export interface SurpayAccount {
  id: string
  processor: string
  status: string
  country: string
  currency: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  business_type?: string | null
  processor_account_id?: string | null
}

export interface SurpayConnectResponse {
  account_id: string
  oauth_url: string
}

// API functions
async function fetchSurpayAccounts(): Promise<SurpayAccount[]> {
  return http.get('api/surpay/accounts').json()
}

async function fetchSurpayAccount(accountId: string): Promise<SurpayAccount> {
  return http.get(`api/surpay/accounts/${accountId}`).json()
}

async function connectSurpay(): Promise<SurpayConnectResponse> {
  return http.post('api/surpay/connect').json()
}

// Hooks
export function useSurpayAccounts() {
  return useQuery({
    queryKey: ['surpay-accounts'],
    queryFn: fetchSurpayAccounts,
    staleTime: 1000 * 30, // 30 seconds
  })
}

export function useSurpayAccount(accountId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['surpay-account', accountId],
    queryFn: () => fetchSurpayAccount(accountId!),
    enabled: Boolean(accountId) && (options?.enabled ?? true),
    staleTime: 1000 * 30, // 30 seconds
  })
}

export function useSurpayConnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: connectSurpay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts'] })
    },
  })
}
