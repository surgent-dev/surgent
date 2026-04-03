import { fetchMarketplaceListingsServer } from '@/lib/api-server'
import MarketplaceContent from './marketplace-content'

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const page = Number(resolvedSearchParams.page) || 1
  const initialData = await fetchMarketplaceListingsServer(30, page)

  return <MarketplaceContent searchParams={resolvedSearchParams} initialData={initialData} />
}
