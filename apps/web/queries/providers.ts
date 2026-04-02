import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import {
  getProviderAuthQueryKey,
  getProviderQueryKey,
  invalidateProviderQueries,
} from '@/lib/provider-oauth'

export type ProviderRow = {
  id: string
  provider: string
  organizationId: string
  createdAt: string
  updatedAt: string
  authType: 'api' | 'chatgpt'
}

export type ChatgptAuthorizeResponse = {
  url: string
  method: 'auto' | 'code'
  instructions?: string
  requestId: string
}

export type AuthMethod = {
  type: 'oauth' | 'api'
  label: string
}

export type AuthMethodsMap = Record<string, AuthMethod[]>

async function fetchProviders(): Promise<ProviderRow[]> {
  return http.get('api/providers').json<ProviderRow[]>()
}

async function fetchProviderAuthMethods(): Promise<AuthMethodsMap> {
  return http.get('api/providers/auth').json<AuthMethodsMap>()
}

export function useProvidersQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: getProviderQueryKey(),
    queryFn: fetchProviders,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  })
}

export function useProviderAuthMethods(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: getProviderAuthQueryKey(),
    queryFn: fetchProviderAuthMethods,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  })
}

export function useUpsertProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { provider: string; credentials: string }) =>
      http
        .post('api/providers', {
          json: { provider: args.provider, credentials: args.credentials },
        })
        .json(),
    onSuccess: () => invalidateProviderQueries(queryClient),
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { provider: string }) =>
      http.delete(`api/providers/${args.provider}`).json(),
    onSuccess: () => invalidateProviderQueries(queryClient),
  })
}

export function useChatgptAuthorize() {
  return useMutation({
    mutationFn: () =>
      http
        .post('api/providers/openai/oauth/authorize', {
          json: { method: 0 },
        })
        .json<ChatgptAuthorizeResponse>(),
  })
}
