import type { MetadataRoute } from 'next'
import { fetchMarketplaceListingsServer, fetchStartupsServer } from '@/lib/api-server'

export const revalidate = 300

async function fetchAllMarketplaceListings(pageSize = 100, maxPages = 50) {
  const listings = []
  const seenListingKeys = new Set<string>()

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchMarketplaceListingsServer(pageSize, page)

    if (!batch?.listings?.length) {
      break
    }

    const newListings = batch.listings.filter((listing) => {
      const key = listing.id ?? listing.projectId
      if (seenListingKeys.has(key)) {
        return false
      }
      seenListingKeys.add(key)
      return true
    })

    if (!newListings.length) {
      break
    }

    listings.push(...newListings)

    if (batch.pagination.page >= batch.pagination.totalPages || batch.listings.length < pageSize) {
      break
    }
  }

  return listings
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://surgent.dev'

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/inspirations`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/marketplace`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Dynamic: inspiration detail pages
  const startupsData = await fetchStartupsServer({
    page: 1,
    perPage: 500,
    sort: 'revenue-desc',
  })
  const startupRoutes: MetadataRoute.Sitemap = (startupsData?.startups ?? []).map((s) => ({
    url: `${baseUrl}/inspirations/${s.slug}`,
    lastModified: s.updatedAt ? new Date(s.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Dynamic: marketplace listings
  const listings = await fetchAllMarketplaceListings()
  const listingRoutes: MetadataRoute.Sitemap = (listings ?? [])
    .filter((l) => l.id && l.status === 'active')
    .map((l) => ({
      url: `${baseUrl}/marketplace/${l.id}`,
      lastModified: l.updatedAt ? new Date(l.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  return [...staticRoutes, ...startupRoutes, ...listingRoutes]
}
