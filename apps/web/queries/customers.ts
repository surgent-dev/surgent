import { useQuery } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'

export interface Customer {
  id: string
  projectId: string
  email: string | null
  name: string | null
  processorCustomerId: string | null
}

export interface CustomerWithDetails extends Customer {
  transactions: {
    id: string
    createdAt: string
    type: string
    amount: number
    currency: string
  }[]
  subscriptions: {
    id: string
    createdAt: string
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
  }[]
}

export interface CustomersResponse {
  customers: Customer[]
  total: number
}

async function fetchCustomers(projectId: string): Promise<CustomersResponse> {
  try {
    // API: GET /customers?projectId=xxx
    const data = await payHttp.get('customers', { searchParams: { projectId } }).json<Customer[]>()
    return {
      customers: data ?? [],
      total: data?.length ?? 0,
    }
  } catch (error) {
    console.error('Failed to fetch customers:', error)
    return { customers: [], total: 0 }
  }
}

export function useCustomers(projectId?: string) {
  return useQuery({
    queryKey: ['customers', projectId],
    queryFn: () => fetchCustomers(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30,
  })
}
