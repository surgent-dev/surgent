import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'
import { usePayEnv } from '@/stores/pay-env'

// Types
export interface SurpayAccountData {
  email?: string
  title?: string
  country?: string
  [key: string]: unknown
}

export interface SurpayAccount {
  id: string
  processor: string
  status: string
  country: string
  currency: string
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  businessType?: string | null
  processorAccountId?: string | null
  data: SurpayAccountData
}

export interface SurpayConnectResponse {
  oauthUrl: string
}

// API functions
async function fetchSurpayAccounts(): Promise<SurpayAccount[]> {
  return payHttp.get('accounts').json()
}

async function connectSurpay(projectId: string): Promise<SurpayConnectResponse> {
  try {
    return await payHttp
      .post('accounts/connect', {
        searchParams: { projectId },
        json: { country: 'us' },
      })
      .json()
  } catch (e) {
    throw e instanceof Error && e.message ? e : new Error('Failed to connect payment account')
  }
}

export interface WhopConnectRequest {
  email?: string
  title: string
  country: string
  businessType?: string
}

export interface WhopConnectResponse {
  accountId: string
  processorAccountId: string
  status: string
}

async function connectWhop(
  data: WhopConnectRequest,
  accountId?: string,
): Promise<WhopConnectResponse> {
  try {
    const searchParams: Record<string, string> = {}
    if (accountId) {
      searchParams.accountId = accountId
    }
    return await payHttp
      .post('accounts/connect/whop', {
        searchParams,
        json: data,
      })
      .json()
  } catch (e) {
    throw e instanceof Error && e.message ? e : new Error('Failed to connect Whop')
  }
}

async function disconnectSurpay(accountId: string): Promise<{ disconnected: boolean }> {
  return payHttp.delete(`accounts/${accountId}`).json()
}

// Hooks
export function useSurpayAccounts() {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['surpay-accounts', env],
    queryFn: fetchSurpayAccounts,
    staleTime: 1000 * 30,
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

export function useWhopConnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data, accountId }: { data: WhopConnectRequest; accountId?: string }) =>
      connectWhop(data, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts'] })
    },
  })
}

export function useSurpayDisconnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId }: { accountId: string }) => disconnectSurpay(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts'] })
    },
  })
}
