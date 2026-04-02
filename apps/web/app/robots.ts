import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/ingest/', '/admin', '/dashboard', '/project', '/company'],
    },
    sitemap: 'https://surgent.dev/sitemap.xml',
  }
}
