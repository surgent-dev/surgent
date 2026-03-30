import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { http } from '@/lib/http'

const PurchaseSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  status: z.enum(['pending', 'provisioning', 'fulfilled', 'failed']),
  projectId: z.string().nullable(),
  createdAt: z.string().nullable(),
  fulfilledAt: z.string().nullable(),
})

const PurchaseDetailSchema = PurchaseSchema.extend({
  fulfillment: z
    .object({
      projectCreatedAt: z.string().optional(),
      sandboxProvisionedAt: z.string().optional(),
      codebaseRestoredAt: z.string().optional(),
      integrationsProvisionedAt: z.string().optional(),
      envVarsSetAt: z.string().optional(),
      devServerStartedAt: z.string().optional(),
      finalizedAt: z.string().optional(),
      lastError: z.string().nullable().optional(),
    })
    .nullable(),
  error: z.string().nullable(),
})

const PurchasesResponseSchema = z.object({
  purchases: z.array(PurchaseSchema),
})

const ClaimResponseSchema = z.object({
  purchaseId: z.string(),
  status: z.string(),
  projectId: z.string().nullable(),
  alreadyClaimed: z.boolean(),
})

export type Purchase = z.infer<typeof PurchaseSchema>
export type PurchaseDetail = z.infer<typeof PurchaseDetailSchema>

async function fetchPurchases(limit = 20): Promise<Purchase[]> {
  const data = await http.get(`api/projects/marketplace/purchases?limit=${limit}`).json()
  return PurchasesResponseSchema.parse(data).purchases
}

async function fetchPurchase(id: string): Promise<PurchaseDetail> {
  const data = await http.get(`api/projects/marketplace/purchases/${id}`).json()
  return PurchaseDetailSchema.parse(data)
}

async function claimListing(listingId: string) {
  const data = await http.post('api/projects/marketplace/claim', { json: { listingId } }).json()
  return ClaimResponseSchema.parse(data)
}

export function usePurchasesQuery(limit = 20) {
  return useQuery({
    queryKey: ['purchases', limit],
    queryFn: () => fetchPurchases(limit),
    staleTime: 10_000,
  })
}

const MAX_POLL_MS = 10 * 60 * 1000

export function usePurchaseQuery(id?: string) {
  return useQuery({
    queryKey: ['purchase', id],
    queryFn: () => fetchPurchase(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'provisioning') {
        const created = query.state.data?.createdAt
        if (created && Date.now() - new Date(created).getTime() > MAX_POLL_MS) return false
        return 3000
      }
      return false
    },
  })
}

export function useClaimListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: claimListing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] })
    },
  })
}
