import { useQuery } from '@tanstack/react-query'
import { payHttp } from '@/lib/http'
import { usePayEnv } from '@/stores/pay-env'

export interface Customer {
  id: string
  projectId: string
  externalId: string | null
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
  const data = await payHttp.get('customers', { searchParams: { projectId } }).json<Customer[]>()
  return {
    customers: data ?? [],
    total: data?.length ?? 0,
  }
}

export function useCustomers(projectId?: string) {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['customers', projectId, env],
    queryFn: () => fetchCustomers(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30,
  })
}

async function fetchCustomerDetail(
  customerId: string,
  projectId: string,
): Promise<CustomerWithDetails> {
  return payHttp
    .get(`customers/${encodeURIComponent(customerId)}`, { searchParams: { projectId } })
    .json<CustomerWithDetails>()
}

export function useCustomerDetail(customerId?: string, projectId?: string) {
  const env = usePayEnv((s) => s.env)
  return useQuery({
    queryKey: ['customer-detail', customerId, projectId, env],
    queryFn: () => fetchCustomerDetail(customerId!, projectId!),
    enabled: Boolean(customerId && projectId),
    staleTime: 1000 * 30,
  })
}
