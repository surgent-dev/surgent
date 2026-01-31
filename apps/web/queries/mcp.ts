import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/http'

export type McpServerStatus = {
  status: 'connected' | 'failed'
  error?: string
}

export type McpStatus = {
  convex: McpServerStatus
  pay: McpServerStatus
}

async function fetchMcpStatus(): Promise<McpStatus> {
  return http.get('api/mcp').json()
}

export function useMcpStatusQuery(enabled = true) {
  return useQuery({
    queryKey: ['mcp-status'],
    queryFn: fetchMcpStatus,
    enabled,
    staleTime: 30000,
    refetchInterval: 60000,
  })
}
