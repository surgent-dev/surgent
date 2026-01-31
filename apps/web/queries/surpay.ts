import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'

// Types
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
}

export interface SurpayConnectResponse {
  oauthUrl: string
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
  return payHttp.get(`accounts/${accountId}`).json()
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

async function connectWhop(
  projectId: string,
  data: WhopConnectRequest,
): Promise<WhopConnectResponse> {
  try {
    return await payHttp
      .post('accounts/connect/whop', {
        searchParams: { projectId },
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
  return useQuery({
    queryKey: ['surpay-accounts', projectId],
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
  return useQuery({
    queryKey: ['surpay-account', projectId, accountId],
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

export function useWhopConnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: WhopConnectRequest }) =>
      connectWhop(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surpay-accounts'] })
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
