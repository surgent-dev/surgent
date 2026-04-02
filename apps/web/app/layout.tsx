import './globals.css'
import { Analytics as DubAnalytics } from '@dub/analytics/react'
import { GoogleAnalytics } from '@next/third-parties/google'
import type { Metadata, Viewport } from 'next'
import {
  Instrument_Serif,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Space_Grotesk,
} from 'next/font/google'
import { Toaster } from 'sonner'
import Providers from '@/components/providers'
import { serializeJsonLd } from '@/lib/json-ld'
import { organizationStructuredData, siteConfig, websiteStructuredData } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: 'Surgent — AI That Builds and Grows Your Business',
    template: '%s | Surgent',
  },
  description: siteConfig.description,
  authors: [{ name: 'Surgent' }],
  creator: 'Surgent',
  publisher: siteConfig.organizationName,
  openGraph: {
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: 'Surgent — AI that builds and grows your business',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@surgentdev',
    creator: '@surgentdev',
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [{ url: '/favicon.ico' }],
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased ${plusJakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
      >
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Next.js recommends JSON-LD scripts via dangerouslySetInnerHTML, and the payload is serialized to escape "<".
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd([organizationStructuredData, websiteStructuredData]),
          }}
        />
        <Providers>{children}</Providers>
        <Toaster position="top-center" theme="system" gap={8} />
        <DubAnalytics
          publishableKey={process.env.NEXT_PUBLIC_DUB_PUBLISHABLE_KEY}
          domainsConfig={{
            refer: 'go.surgent.dev',
          }}
        />
      </body>
      <GoogleAnalytics gaId="G-ZXHRJ2KM14" />
    </html>
  )
}
