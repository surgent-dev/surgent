import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchMarketplaceListingServer } from '@/lib/api-server'
import { siteConfig } from '@/lib/seo'
import ListingPage from './listing-detail'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const listing = await fetchMarketplaceListingServer(id)

  if (!listing) {
    return { title: 'Listing Not Found' }
  }

  const title = listing.title
  const image = listing.imageUrl ?? siteConfig.ogImage
  const description =
    listing.description.slice(0, 160) || `${listing.title} — available on the Surgent marketplace.`
  const url = `${siteConfig.url}/marketplace/${id}`

  return {
    title,
    description,
    alternates: { canonical: `/marketplace/${id}` },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'website',
      images: [{ url: image, alt: listing.title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@surgentdev',
      creator: '@surgentdev',
      title,
      description,
      images: [image],
    },
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const listing = await fetchMarketplaceListingServer(id)

  if (!listing) {
    notFound()
  }

  return <ListingPage id={id} initialListing={listing} />
}
