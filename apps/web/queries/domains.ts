import { http } from '@/lib/http'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

// Types

export interface DomainLogEntry {
  timestamp: string
  event: string
  detail?: string
  success?: boolean
}

export interface SslProvisioningMeta {
  _type: 'ssl_provisioning_meta'
  attempts: number
  firstAttemptAt: string
  lastAttemptAt: string
}

export interface DomainAvailability {
  domain: string
  available: boolean
  price?: number
  reason: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSUPPORTED_TLD' | 'ERROR'
  checkedAt: string
}

interface EntriPurchaseConfig {
  token: string
  applicationId: string
  dnsRecords: Array<{
    type: string
    host: string
    value: string
    ttl: number
    applicationUrl?: string
  }>
  domainId?: string
  prefilledDomain?: string
  devMode?: boolean
  contact: { email: string; firstName: string; lastName: string }
}

interface EntriConnectConfig {
  token: string
  applicationId: string
  dnsRecords: Array<{
    type: string
    host: string
    value: string
    ttl: number
    applicationUrl?: string
  }>
  domainId: string
  prefilledDomain: string
  userId: string
}

export interface Domain {
  id: string
  projectId: string | null
  domainName: string
  status: 'pending' | 'purchasing' | 'dns_configuring' | 'ssl_provisioning' | 'active' | 'error'
  registrar: string | null
  lastError: string | null
  sslMeta: SslProvisioningMeta | null
  isPrimary: boolean
  logs: DomainLogEntry[]
  purchasedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

// Hooks

export function useProjectDomains(projectId?: string, fastPoll?: boolean) {
  return useQuery({
    queryKey: ['domains', projectId],
    queryFn: () => http.get(`api/domains/${projectId}`).json<{ domains: Domain[] }>(),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      if (fastPoll) return 2000
      const domains = query.state.data?.domains
      const hasPending = domains?.some((d) =>
        ['pending', 'purchasing', 'dns_configuring'].includes(d.status),
      )
      if (hasPending) return 3000

      // For ssl_provisioning, slow down polling to match backend backoff
      const provisioning = domains?.find((d) => d.status === 'ssl_provisioning')
      if (provisioning) {
        const meta = provisioning.sslMeta
        if (meta && meta.attempts > 40) return 15000
        if (meta && meta.attempts > 20) return 8000
        return 3000
      }

      return 30000
    },
  })
}

export function useCheckDomainAvailability() {
  return useMutation({
    mutationFn: (domain: string) =>
      http
        .post('api/domains/check-availability', { json: { domain } })
        .json<DomainAvailability[]>(),
    onError: () => {
      toast.error('Failed to check domain availability')
    },
  })
}

export function useInitDomainPurchase() {
  return useMutation({
    mutationFn: (params: { projectId: string; suggestedDomain?: string; freeDomain?: boolean }) =>
      http.post('api/domains/init-purchase', { json: params }).json<EntriPurchaseConfig>(),
    onError: () => {
      toast.error('Failed to initialize domain purchase')
    },
  })
}

export function useInitDomainConnect() {
  return useMutation({
    mutationFn: (params: { projectId: string; domain: string }) =>
      http.post('api/domains/init-connect', { json: params }).json<EntriConnectConfig>(),
    onError: () => {
      toast.error('Failed to initialize domain connection')
    },
  })
}

export type RetryConnectResult = EntriConnectConfig

export function useRetryDomainConnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { projectId: string; domainId: string }) =>
      http.post('api/domains/retry-connect', { json: params }).json<RetryConnectResult>(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['domains', vars.projectId] })
    },
    onError: () => {
      toast.error('Failed to retry domain connection')
    },
  })
}

export function useBindEntriFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      projectId: string
      entriFlowId: string
      domain: string
      domainId?: string
      freeDomain?: boolean
    }) => http.post('api/domains/bind-entri-flow', { json: params }).json<{ ok: boolean }>(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['domains', vars.projectId] })
    },
    onError: () => {
      toast.error('Failed to sync domain setup')
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

export function useSetPrimaryDomain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { projectId: string; domainId: string }) =>
      http.post('api/domains/set-primary', { json: params }).json<{ ok: boolean }>(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['domains', vars.projectId] })
      toast.success('Primary domain updated')
    },
    onError: () => {
      toast.error('Failed to update primary domain')
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['domains'] })
      toast.success(`[DEV] Domain ${data.domainName} activated instantly`)
    },
    onError: () => {
      toast.error('Mock purchase failed')
    },
  })
}

export interface DomainConfig {
  freeDomainEnabled: boolean
}

export function useDomainConfig() {
  return useQuery({
    queryKey: ['domain-config'],
    queryFn: () => http.get('api/domains/config').json<DomainConfig>(),
    staleTime: 5 * 60 * 1000,
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
