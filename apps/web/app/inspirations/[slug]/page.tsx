import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchStartupServer } from '@/lib/api-server'
import { siteConfig } from '@/lib/seo'
import StartupDetailPage from './startup-detail'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const startup = await fetchStartupServer(slug)

  if (!startup) {
    return { title: 'Startup Not Found' }
  }

  const title = `${startup.name} — Revenue, Growth & Stats`
  const image = startup.icon ?? siteConfig.ogImage
  const description =
    startup.description ??
    `View ${startup.name} revenue data, growth metrics, and business details. Get inspired and build your own version with Surgent AI.`
  const url = `${siteConfig.url}/inspirations/${slug}`

  return {
    title,
    description,
    alternates: { canonical: `/inspirations/${slug}` },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'website',
      images: [{ url: image, alt: startup.name }],
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
  const { slug } = await params
  const startup = await fetchStartupServer(slug)

  if (!startup) {
    notFound()
  }

  return <StartupDetailPage slug={slug} initialStartup={startup} />
}
