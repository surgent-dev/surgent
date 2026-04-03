import type { Metadata } from 'next'
import { serializeJsonLd } from '@/lib/json-ld'
import { createPageMetadata, siteConfig } from '@/lib/seo'
import HomeContent from './home-content'

export const metadata: Metadata = createPageMetadata({
  title: 'AI That Builds and Grows Your Business',
  description:
    'Describe your business. Surgent builds your site, adds an AI sales agent, and grows your revenue on autopilot. No code needed.',
  path: '/',
})

const homeStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteConfig.name,
  url: siteConfig.url,
  image: `${siteConfig.url}/surgent-logo.png`,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Website Builder',
  operatingSystem: 'Web',
  description:
    'AI-powered business builder that creates websites, deploys AI sales agents, and grows revenue on autopilot.',
  publisher: {
    '@type': 'Organization',
    name: siteConfig.organizationName,
    url: siteConfig.url,
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function Index() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Next.js recommends JSON-LD scripts via dangerouslySetInnerHTML, and the payload is serialized to escape "<".
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(homeStructuredData),
        }}
      />
      <HomeContent />
    </>
  )
}
