import type { Metadata } from 'next'

export const siteConfig = {
  name: 'Surgent',
  description:
    'AI-powered business builder. Describe your business and Surgent creates your website, deploys an AI sales agent, and grows your revenue on autopilot.',
  url: 'https://surgent.dev',
  ogImage: '/opengraph-image',
  organizationName: 'Benrov, Inc.',
} as const

export const organizationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteConfig.organizationName,
  brand: siteConfig.name,
  url: siteConfig.url,
  logo: `${siteConfig.url}/surgent-logo.png`,
  description: siteConfig.description,
  sameAs: [
    'https://x.com/surgentdev',
    'https://linkedin.com/company/surgent',
    'https://discord.gg/surgentdev',
  ],
}

export const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteConfig.name,
  url: siteConfig.url,
  inLanguage: 'en-US',
  publisher: {
    '@type': 'Organization',
    name: siteConfig.organizationName,
    url: siteConfig.url,
  },
}

type PageMetadataOptions = {
  description: string
  path: string
  title: string
  noIndex?: boolean
}

export function createPageMetadata({
  description,
  path,
  title,
  noIndex,
}: PageMetadataOptions): Metadata {
  const url = path === '/' ? siteConfig.url : `${siteConfig.url}${path}`

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: 'Surgent — AI-powered business builder',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@surgentdev',
      creator: '@surgentdev',
      title,
      description,
      images: [siteConfig.ogImage],
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
            googleBot: { index: false, follow: false },
          },
        }
      : {}),
  }
}
