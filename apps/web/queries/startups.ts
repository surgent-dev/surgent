import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { http } from '@/lib/http'

const StartupSchema = z.object({
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  country: z.string().nullable(),
  foundedDate: z.string().nullable(),
  category: z.string().nullable(),
  paymentProvider: z.string().nullable(),
  targetAudience: z.string().nullable(),
  revenueLast30Days: z.coerce.number(),
  revenueMrr: z.coerce.number(),
  revenueTotal: z.coerce.number(),
  customers: z.number(),
  activeSubscriptions: z.number(),
  askingPrice: z.coerce.number().nullable(),
  profitMarginLast30Days: z.coerce.number().nullable(),
  growth30d: z.coerce.number().nullable(),
  multiple: z.coerce.number().nullable(),
  onSale: z.boolean(),
  firstListedForSaleAt: z.string().nullable(),
  xHandle: z.string().nullable(),
  syncedAt: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

const StartupsResponseSchema = z.object({
  startups: z.array(StartupSchema),
  pagination: z.object({
    page: z.number(),
    perPage: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

const CategorySchema = z.object({
  category: z.string().nullable(),
  count: z.coerce.number(),
})

const SyncResponseSchema = z.object({
  fetched: z.number(),
  upserted: z.number(),
  syncedAt: z.string(),
})

export type Startup = z.infer<typeof StartupSchema>
export type StartupsResponse = z.infer<typeof StartupsResponseSchema>

export interface StartupsQueryParams {
  page?: number
  perPage?: number
  sort?: string
  category?: string
  onSale?: string
  search?: string
  minRevenue?: number
  maxRevenue?: number
}

async function fetchStartups(params: StartupsQueryParams): Promise<StartupsResponse> {
  const qp = new URLSearchParams()
  if (params.page) qp.set('page', String(params.page))
  if (params.perPage) qp.set('perPage', String(params.perPage))
  if (params.sort) qp.set('sort', params.sort)
  if (params.category) qp.set('category', params.category)
  if (params.onSale) qp.set('onSale', params.onSale)
  if (params.search) qp.set('search', params.search)
  if (params.minRevenue) qp.set('minRevenue', String(params.minRevenue))
  if (params.maxRevenue) qp.set('maxRevenue', String(params.maxRevenue))

  const data = await http.get(`api/startups?${qp.toString()}`).json()
  return StartupsResponseSchema.parse(data)
}

async function fetchCategories() {
  const data = await http.get('api/startups/categories').json()
  return z.array(CategorySchema).parse(data)
}

async function syncStartups() {
  const data = await http.post('api/startups/sync').json()
  return SyncResponseSchema.parse(data)
}

async function fetchStartup(slug: string): Promise<Startup> {
  const data = await http.get(`api/startups/${slug}`).json()
  return StartupSchema.parse(data)
}

export function useStartupQuery(slug?: string) {
  return useQuery({
    queryKey: ['startup', slug],
    queryFn: () => fetchStartup(slug!),
    enabled: Boolean(slug),
    staleTime: 60_000,
  })
}

export function useStartupsQuery(params: StartupsQueryParams) {
  return useQuery({
    queryKey: ['admin-startups', params],
    queryFn: () => fetchStartups(params),
    staleTime: 60_000,
  })
}

export function useStartupCategoriesQuery() {
  return useQuery({
    queryKey: ['admin-startup-categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  })
}

export function useSyncStartups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: syncStartups,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-startups'] })
      queryClient.invalidateQueries({ queryKey: ['admin-startup-categories'] })
    },
  })
}
