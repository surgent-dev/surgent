import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'

// Types
export interface Product {
  id: string
  productGroup: string
  name: string
  slug: string
  projectId: string
  accountId?: string | null
  description?: string | null
  version?: number | null
  isArchived?: boolean | null
  isDefault?: boolean | null
  processorProductId?: string | null
}

export interface ProductPrice {
  id: string
  name?: string | null
  description?: string | null
  priceAmount: number
  priceCurrency: string
  recurringInterval?: 'week' | 'month' | 'year' | null
  isDefault?: boolean | null
}

export interface ProductWithPrices {
  product: Product
  prices: ProductPrice[]
}

interface CreateProductInput {
  productGroup: string
  name: string
  slug: string
  description?: string
  isDefault?: boolean
}

interface CreateProductResponse {
  productId: string
  productGroup: string
  version: number
}

interface UpdateProductInput {
  name?: string
  description?: string
  slug?: string
  isDefault?: boolean
  isArchived?: boolean
}

interface UpdateProductResponse {
  productId: string
  productGroup: string
  version: number
}

interface CreatePriceInput {
  productGroup: string
  price: number
  priceCurrency: string
  name?: string
  description?: string
  recurringInterval?: 'week' | 'month' | 'year'
  isDefault?: boolean
}

interface CreatePriceResponse {
  productPriceId: string
}

// API functions
async function fetchProducts(projectId: string): Promise<ProductWithPrices[]> {
  return payHttp.get('products', { searchParams: { projectId } }).json()
}

async function createProduct(
  projectId: string,
  input: CreateProductInput,
): Promise<CreateProductResponse> {
  try {
    return await payHttp.post('product', { searchParams: { projectId }, json: input }).json()
  } catch (error: any) {
    // ky throws HTTPError on non-2xx, extract response body for better error message
    if (error.response) {
      const text = await error.response.text()
      throw new Error(text || 'Failed to create product')
    }
    throw error
  }
}

async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<UpdateProductResponse> {
  return payHttp.put(`product/${productId}`, { json: input }).json()
}

async function archiveProduct(productId: string): Promise<UpdateProductResponse> {
  return payHttp.put(`product/${productId}`, { json: { isArchived: true } }).json()
}

async function createPrice(
  projectId: string,
  input: CreatePriceInput,
): Promise<CreatePriceResponse> {
  return payHttp
    .post('product/price', {
      searchParams: { projectId },
      json: input,
    })
    .json()
}

// Hooks
export function useProducts(projectId?: string) {
  return useQuery({
    queryKey: ['products', projectId],
    queryFn: () => fetchProducts(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30,
  })
}

export function useCreateProduct(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', projectId] })
    },
  })
}

export function useUpdateProduct(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: UpdateProductInput }) =>
      updateProduct(productId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', projectId] })
    },
  })
}

export function useArchiveProduct(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId: string) => archiveProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', projectId] })
    },
  })
}

export function useCreatePrice(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePriceInput) => createPrice(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', projectId] })
    },
  })
}
