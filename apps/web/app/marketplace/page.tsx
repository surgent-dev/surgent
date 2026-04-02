import { fetchMarketplaceListingsServer } from '@/lib/api-server'
import MarketplaceContent from './marketplace-content'

export default async function MarketplacePage() {
  const listings = await fetchMarketplaceListingsServer(60)

  return <MarketplaceContent initialListings={listings} />
}
