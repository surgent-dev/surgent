import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { http } from '@/lib/http'

const ListingSchema = z.object({
  id: z.string().nullable(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  productId: z.string().nullable(),
  priceId: z.string().nullable(),
  priceAmount: z.number().nullable(),
  priceCurrency: z.string().nullable(),
  recurringInterval: z.string().nullable(),
  status: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

const MarketplaceListingSchema = ListingSchema.extend({
  projectName: z.string(),
  sellerName: z.string(),
  sellerImage: z.string().nullable(),
  liveUrl: z.string().nullable(),
  purchased: z.boolean().optional(),
  purchaseId: z.string().optional(),
  purchaseStatus: z.string().optional(),
  buyerProjectId: z.string().optional(),
})

const MarketplaceListingsResponseSchema = z.object({
  listings: z.array(MarketplaceListingSchema),
  pagination: z.object({
    page: z.number(),
    perPage: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})
const ProjectListingResponseSchema = z.object({ listing: ListingSchema.nullable() })
const UpsertListingResponseSchema = z.object({ listing: ListingSchema })

export type MarketplaceListing = z.infer<typeof MarketplaceListingSchema>
export type MarketplaceListingsResponse = z.infer<typeof MarketplaceListingsResponseSchema>
export type ProjectListing = z.infer<typeof ListingSchema>

async function fetchMarketplaceListings(
  limit = 48,
  page = 1,
): Promise<MarketplaceListingsResponse> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (page > 1) query.set('page', String(page))
  const data = await http.get(`api/projects/marketplace/listings?${query.toString()}`).json()
  return MarketplaceListingsResponseSchema.parse(data)
}

async function fetchProjectListing(projectId: string): Promise<ProjectListing | null> {
  const data = await http.get(`api/projects/${projectId}/listing`).json()
  return ProjectListingResponseSchema.parse(data).listing
}

async function upsertProjectListing(args: {
  projectId: string
  title?: string
  description: string
  imageUrl?: string
  productId?: string
  priceId?: string
}): Promise<ProjectListing> {
  const data = await http
    .post(`api/projects/${args.projectId}/listing`, {
      json: {
        title: args.title,
        description: args.description,
        imageUrl: args.imageUrl,
        productId: args.productId,
        priceId: args.priceId,
      },
    })
    .json()
  return UpsertListingResponseSchema.parse(data).listing
}

async function fetchMarketplaceListing(id: string): Promise<MarketplaceListing> {
  const data = await http.get(`api/projects/marketplace/listings/${id}`).json()
  return MarketplaceListingSchema.parse(data)
}

export function useMarketplaceListingQuery(id?: string) {
  return useQuery({
    queryKey: ['marketplace-listing', id],
    queryFn: () => fetchMarketplaceListing(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}

export function useMarketplaceListingsQuery(limit = 48, page = 1) {
  return useQuery({
    queryKey: ['marketplace-listings', limit, page],
    queryFn: () => fetchMarketplaceListings(limit, page),
    staleTime: 30_000,
  })
}

export function useProjectListingQuery(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['project-listing', projectId],
    queryFn: () => fetchProjectListing(projectId!),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  })
}

export function useUpsertProjectListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertProjectListing,
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ['project-listing', listing.projectId] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
    },
  })
}

// ── Purchase status polling ──────────────────────────────────────────────

const PurchaseStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  step: z.string().nullable(),
  buyerProjectId: z.string().nullable(),
  failReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>

async function fetchPurchaseStatus(id: string): Promise<PurchaseStatus> {
  const data = await http.get(`api/projects/marketplace/purchases/${id}`).json()
  return PurchaseStatusSchema.parse(data)
}

export function usePurchaseStatusQuery(purchaseId?: string) {
  return useQuery({
    queryKey: ['purchase-status', purchaseId],
    queryFn: () => fetchPurchaseStatus(purchaseId!),
    enabled: Boolean(purchaseId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'ready' || status === 'failed' ? false : 2000
    },
  })
}

// ── Free template claim ──────────────────────────────────────────────────

async function claimFreeTemplate(
  listingId: string,
): Promise<{ purchaseId: string; status: string }> {
  const data = await http
    .post('api/projects/marketplace/use-template', { json: { listingId } })
    .json()
  return data as { purchaseId: string; status: string }
}

export function useClaimFreeListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: claimFreeTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-listing'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ── Republish template ───────────────────────────────────────────────────

async function republishTemplate(
  projectId: string,
): Promise<{ snapshotId: string; version: number }> {
  const data = await http.post(`api/projects/${projectId}/republish`).json()
  return data as { snapshotId: string; version: number }
}

export function useRepublishTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: republishTemplate,
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['project-listing', projectId] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
    },
  })
}
