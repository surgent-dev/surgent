import { http } from '@/lib/http'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

// Types

interface DomainAvailability {
  domain: string
  available: boolean
  reason: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSUPPORTED_TLD' | 'ERROR'
  checkedAt: string
}

interface EntriPurchaseConfig {
  token: string
  applicationId: string
  dnsRecords: Array<{ type: string; host: string; value: string; ttl: number }>
  domainId: string
  prefilledDomain?: string
  devMode?: boolean
  contact: { email: string; firstName: string; lastName: string }
}

export interface Domain {
  id: string
  projectId: string | null
  domainName: string
  status: 'pending' | 'purchasing' | 'dns_configuring' | 'active' | 'error'
  registrar: string | null
  purchasedAt: string | null
  expiresAt: string | null
  createdAt: string
}

// Hooks

export function useProjectDomains(projectId?: string) {
  return useQuery({
    queryKey: ['domains', projectId],
    queryFn: () => http.get(`api/domains/${projectId}`).json<{ domains: Domain[] }>(),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const domains = query.state.data?.domains
      const hasPending = domains?.some((d) =>
        ['pending', 'purchasing', 'dns_configuring'].includes(d.status),
      )
      return hasPending ? 3000 : 30000
    },
  })
}

export function useCheckDomainAvailability() {
  return useMutation({
    mutationFn: (domain: string) =>
      http.post('api/domains/check-availability', { json: { domain } }).json<DomainAvailability>(),
    onError: () => {
      toast.error('Failed to check domain availability')
    },
  })
}

export function useInitDomainPurchase() {
  return useMutation({
    mutationFn: (params: { projectId: string; suggestedDomain?: string }) =>
      http.post('api/domains/init-purchase', { json: params }).json<EntriPurchaseConfig>(),
    onError: () => {
      toast.error('Failed to initialize domain purchase')
    },
  })
}

export function useRemoveDomain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, domainId }: { projectId: string; domainId: string }) =>
      http.delete(`api/domains/${projectId}/${domainId}`).json<{ deleted: boolean }>(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['domains', vars.projectId] })
      toast.success('Domain removed')
    },
    onError: () => {
      toast.error('Failed to remove domain')
    },
  })
}

export function useMockDomainPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { domainId: string; domainName: string }) =>
      http
        .post('api/domains/mock-purchase', { json: params })
        .json<{ ok: boolean; domainName: string; status: string }>(),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['domains'] })
      toast.success(`[DEV] Domain ${data.domainName} activated instantly`)
    },
    onError: () => {
      toast.error('Mock purchase failed')
    },
  })
}

export function useOnDomainPurchased() {
  const qc = useQueryClient()
  return (projectId: string, domainName: string) => {
    qc.invalidateQueries({ queryKey: ['domains', projectId] })
    qc.invalidateQueries({ queryKey: ['project', projectId] })
    toast.success(`Domain ${domainName} is being configured!`)
  }
}
