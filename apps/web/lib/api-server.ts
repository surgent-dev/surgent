import 'server-only'
import { z } from 'zod'
import type { InspirationsQueryParams } from '@/lib/inspirations-search'
import { serverBackendUrl } from '@/lib/server-backend'

/**
 * Lightweight server-side API client for metadata generation and SEO-friendly
 * page rendering. It intentionally avoids the shared client HTTP layer.
 */

async function serverFetch<T>(path: string, parse?: (value: unknown) => T): Promise<T | null> {
  const url = new URL(path, `${serverBackendUrl}/`)
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      next: { revalidate: 300 }, // cache 5 min
    })
    if (!res.ok) {
      console.error(`[api-server] ${res.status} ${res.statusText} for ${url}`)
      return null
    }
    const json = await res.json()
    return parse ? parse(json) : (json as T)
  } catch (error) {
    console.error(`[api-server] Failed to fetch ${url}`, error)
    return null
  }
}

export type StartupRecord = {
  slug: string
  name: string
  icon: string | null
  description: string | null
  website: string | null
  country: string | null
  foundedDate: string | null
  category: string | null
  paymentProvider: string | null
  targetAudience: string | null
  revenueLast30Days: number
  revenueMrr: number
  revenueTotal: number
  customers: number
  activeSubscriptions: number
  askingPrice: number | null
  profitMarginLast30Days: number | null
  growth30d: number | null
  multiple: number | null
  onSale: boolean
  firstListedForSaleAt: string | null
  xHandle: string | null
  syncedAt: string
  createdAt: string | null
  updatedAt: string | null
}

export type StartupCategoryRecord = {
  category: string | null
  count: number
}

type Pagination = {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export type StartupListResponse = {
  startups: StartupRecord[]
  pagination: Pagination
}

const StartupRecordSchema = z.object({
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
  customers: z.coerce.number(),
  activeSubscriptions: z.coerce.number(),
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

const StartupListResponseSchema = z.object({
  startups: z.array(StartupRecordSchema),
  pagination: z.object({
    page: z.number(),
    perPage: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

const StartupCategorySchema = z.object({
  category: z.string().nullable(),
  count: z.coerce.number(),
})

const MarketplaceListingRecordSchema = z.object({
  id: z.string().nullable(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  productId: z.string().nullable(),
  priceId: z.string().nullable(),
  priceAmount: z.coerce.number().nullable(),
  priceCurrency: z.string().nullable(),
  recurringInterval: z.string().nullable(),
  liveUrl: z.string().nullable(),
  projectName: z.string(),
  sellerName: z.string(),
  sellerImage: z.string().nullable(),
  purchased: z.boolean().optional(),
  status: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export function fetchStartupServer(slug: string) {
  return serverFetch<StartupRecord>(`api/startups/${slug}`, (value) =>
    StartupRecordSchema.parse(value),
  )
}

export function fetchStartupsServer(params: Partial<InspirationsQueryParams> = {}) {
  const query = new URLSearchParams()

  if (params.page) query.set('page', String(params.page))
  if (params.perPage) query.set('perPage', String(params.perPage))
  if (params.sort) query.set('sort', params.sort)
  if (params.category) query.set('category', params.category)
  if (params.minRevenue) query.set('minRevenue', String(params.minRevenue))
  if (params.maxRevenue) query.set('maxRevenue', String(params.maxRevenue))

  return serverFetch<StartupListResponse>(`api/startups?${query.toString()}`, (value) =>
    StartupListResponseSchema.parse(value),
  )
}

export function fetchStartupCategoriesServer() {
  return serverFetch<StartupCategoryRecord[]>('api/startups/categories', (value) =>
    z.array(StartupCategorySchema).parse(value),
  )
}

export type MarketplaceListingRecord = {
  id: string | null
  projectId: string
  title: string
  description: string
  imageUrl: string | null
  productId: string | null
  priceId: string | null
  priceAmount: number | null
  priceCurrency: string | null
  recurringInterval: string | null
  liveUrl: string | null
  projectName: string
  sellerName: string
  sellerImage: string | null
  purchased?: boolean
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export function fetchMarketplaceListingServer(id: string) {
  return serverFetch<MarketplaceListingRecord>(`api/projects/marketplace/listings/${id}`, (value) =>
    MarketplaceListingRecordSchema.parse(value),
  )
}

export function fetchMarketplaceListingsServer(limit = 200) {
  const safeLimit = Math.min(limit, 100)
  return serverFetch<MarketplaceListingRecord[]>(
    `api/projects/marketplace/listings?limit=${safeLimit}`,
    (value) => z.array(MarketplaceListingRecordSchema).parse(value),
  )
}
