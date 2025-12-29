import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { http } from '@/lib/http'

interface Merchant {
  id: string
  name: string
  email?: string
  whopCompanyId?: string
}

interface ProductMetadata {
  previewUrl?: string
  thumbnailUrl?: string
}

interface Product {
  id: string
  merchantId: string
  projectId: string
  title: string
  slug: string
  description?: string
  status: string
  metadata?: ProductMetadata | null
  prices?: ProductPrice[]
}

interface ProductPrice {
  id: string
  productId: string
  code: string
  amount: number
  currency: string
  active: boolean
}

async function fetchMerchant(): Promise<Merchant | null> {
  try {
    return await http.get('api/marketplace/merchant').json()
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 404) {
      return null
    }
    throw err
  }
}

async function onboardMerchant(params: {
  name: string
  email?: string
  createWhopCompany?: boolean
}): Promise<Merchant> {
  try {
    return await http.post('api/marketplace/merchant/onboard', { json: params }).json()
  } catch (err) {
    if (err instanceof HTTPError) {
      const body = await err.response.json<{ error?: string }>().catch(() => null)
      throw new Error(body?.error ?? 'Failed to create merchant')
    }
    throw err
  }
}

async function createProduct(params: {
  projectId: string
  title: string
  slug: string
  description?: string
  previewUrl?: string
  thumbnailUrl?: string
  price: {
    code: string
    amount: number
    currency: string
  }
}): Promise<Product> {
  try {
    return await http.post('api/marketplace/products', { json: params }).json()
  } catch (err) {
    if (err instanceof HTTPError) {
      const body = await err.response.json<{ error?: string }>().catch(() => null)
      throw new Error(body?.error ?? 'Failed to create product')
    }
    throw err
  }
}

async function updateProduct(params: {
  productId: string
  title?: string
  description?: string
  previewUrl?: string | null
  thumbnailUrl?: string | null
}): Promise<Product> {
  try {
    const { productId, ...body } = params
    return await http.patch(`api/marketplace/products/${productId}`, { json: body }).json()
  } catch (err) {
    if (err instanceof HTTPError) {
      const body = await err.response.json<{ error?: string }>().catch(() => null)
      throw new Error(body?.error ?? 'Failed to update product')
    }
    throw err
  }
}

async function fetchProductByProjectId(projectId: string): Promise<Product | null> {
  try {
    return await http.get(`api/marketplace/products/by-project/${projectId}`).json()
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 404) {
      return null
    }
    throw err
  }
}

interface BrowseProduct {
  id: string
  merchantId: string
  projectId: string
  title: string
  slug: string
  description?: string
  status: string
  metadata?: ProductMetadata | null
  createdAt: string
  merchantName: string
  priceId: string | null
  priceAmount: number | null
  priceCurrency: string | null
  priceCode: string | null
}

interface CheckoutResponse {
  orderId: string
  checkoutId: string
  purchaseUrl: string
}

async function fetchAllProducts(): Promise<BrowseProduct[]> {
  return await http.get('api/marketplace/browse').json()
}

async function checkout(params: {
  productId: string
  priceId: string
  redirectUrl?: string
}): Promise<CheckoutResponse> {
  return await http.post('api/marketplace/checkout', { json: params }).json()
}

export function useMerchantQuery() {
  return useQuery({
    queryKey: ['merchant'],
    queryFn: fetchMerchant,
  })
}

export function useOnboardMerchant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: onboardMerchant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['merchant'] }),
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-by-project', vars.projectId] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-by-project', data.projectId] })
    },
  })
}

export function useProductByProjectId(projectId?: string) {
  return useQuery({
    queryKey: ['product-by-project', projectId],
    queryFn: () => fetchProductByProjectId(projectId!),
    enabled: Boolean(projectId),
  })
}

export function useBrowseProducts() {
  return useQuery({
    queryKey: ['browse-products'],
    queryFn: fetchAllProducts,
  })
}

export function useCheckout() {
  return useMutation({
    mutationFn: checkout,
  })
}

