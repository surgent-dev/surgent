import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { http } from '@/lib/http'

const UsageRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  days: z.number(),
})

const UsageTotalsSchema = z.object({
  cost: z.string(),
  messages: z.string(),
  inputTokens: z.string(),
  outputTokens: z.string(),
})

const UsageProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  cost: z.string(),
  messages: z.string(),
  inputTokens: z.string(),
  outputTokens: z.string(),
})

const UsageModelSchema = z.object({
  model: z.string(),
  provider: z.string(),
  cost: z.string(),
  messages: z.string(),
  inputTokens: z.string(),
  outputTokens: z.string(),
})

const UsageDailySchema = z.object({
  date: z.string(),
  cost: z.string(),
  messages: z.string(),
  inputTokens: z.string(),
  outputTokens: z.string(),
})

const UsageHistorySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  model: z.string(),
  provider: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cost: z.string(),
  createdAt: z.string().nullable(),
})

const UsageSchema = z.object({
  range: UsageRangeSchema,
  totals: UsageTotalsSchema,
  projects: z.array(UsageProjectSchema),
  models: z.array(UsageModelSchema),
  daily: z.array(UsageDailySchema),
  history: z.array(UsageHistorySchema),
})

export type UsageOverview = z.infer<typeof UsageSchema>

async function fetchUsage(days = 30, limit = 50, projectId?: string): Promise<UsageOverview> {
  const qp = new URLSearchParams()
  qp.set('days', String(days))
  qp.set('limit', String(limit))
  if (projectId) qp.set('projectId', projectId)
  const data = await http.get(`api/projects/usage?${qp.toString()}`).json()
  return UsageSchema.parse(data)
}

export function useUsageQuery(
  projectId?: string,
  opts?: {
    days?: number
    limit?: number
    enabled?: boolean
  },
) {
  const days = opts?.days ?? 30
  const limit = opts?.limit ?? 50
  const enabled = opts?.enabled ?? true

  return useQuery({
    queryKey: ['usage', projectId ?? 'all', days, limit],
    queryFn: () => fetchUsage(days, limit, projectId),
    enabled,
    staleTime: 30_000,
  })
}
