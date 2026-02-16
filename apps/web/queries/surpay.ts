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

export interface UserSurpayAccount {
  id: string
  processor: string
  processorAccountId: string | null
  status: string
  projectId: string | null
  email: string | null
  title: string | null
  country: string | null
}

// Extracts error message from ky HTTPError response
async function extractError(error: any, fallback: string): Promise<never> {
  if (error.response) {
    const text = await error.response.text()
    throw new Error(text || fallback)
  }
  throw error
}

// API functions
async function fetchSurpayAccounts(projectId: string): Promise<SurpayAccount[]> {
  return payHttp.get('accounts', { searchParams: { projectId } }).json()
}

async function fetchSurpayAccount(projectId: string, accountId: string): Promise<SurpayAccount> {
  return payHttp.get(`accounts/${accountId}`, { searchParams: { projectId } }).json()
}

async function connectSurpay(projectId: string): Promise<SurpayConnectResponse> {
  try {
    return await payHttp
      .post('accounts/connect', {
        searchParams: { projectId },
        json: { processor: 'stripe', country: 'us' },
      })
      .json()
  } catch (e) {
    return extractError(e, 'Failed to connect Stripe')
  }
}

export interface WhopConnectRequest {
  email: string
  title: string
  country: string
  businessType?: string
}

export interface WhopConnectResponse {
  accountId: string
  processorAccountId: string
  status: string
}

async function fetchUserWhopAccounts(): Promise<UserSurpayAccount[]> {
  return payHttp.get('accounts/user', { searchParams: { processor: 'whop' } }).json()
}

async function connectWhop(
  projectId: string,
  data: WhopConnectRequest,
  accountId?: string,
): Promise<WhopConnectResponse> {
  try {
    const searchParams: Record<string, string> = { projectId }
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
    return extractError(e, 'Failed to connect Whop')
  }
}

async function disconnectSurpay(accountId: string): Promise<{ disconnected: boolean }> {
  return payHttp.delete(`accounts/${accountId}`).json()
}

async function moveAccount(accountId: string, projectId: string): Promise<SurpayAccount> {
  return payHttp.patch(`accounts/${accountId}`, { json: { projectId } }).json()
}

// Hooks
export function useSurpayAccounts(projectId?: string) {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['surpay-accounts', projectId, env],
    queryFn: () => fetchSurpayAccounts(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30, // 30 seconds
  })
}

export function useSurpayAccount(
  projectId?: string,
  accountId?: string,
  options?: { enabled?: boolean },
) {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['surpay-account', projectId, accountId, env],
    queryFn: () => fetchSurpayAccount(projectId!, accountId!),
    enabled: Boolean(projectId) && Boolean(accountId) && (options?.enabled ?? true),
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

export function useUserWhopAccounts() {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['user-whop-accounts', env],
    queryFn: fetchUserWhopAccounts,
    staleTime: 1000 * 30,
  })
}

export function useWhopConnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId,
      data,
      accountId,
    }: {
      projectId: string
      data: WhopConnectRequest
      accountId?: string
    }) => connectWhop(projectId, data, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['user-whop-accounts'] })
    },
  })
}

export function useSurpayDisconnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId }: { projectId: string; accountId: string }) =>
      disconnectSurpay(accountId),
    onSuccess: (_res, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts', projectId] })
    },
  })
}

export function useSurpayMoveAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, projectId }: { accountId: string; projectId: string }) =>
      moveAccount(accountId, projectId),
    onSuccess: (_res, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts', projectId] })
    },
  })
}
