import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Marketplace — Buy & Sell AI-Built Websites',
  description:
    'Browse and buy AI-built websites and templates on the Surgent marketplace. Find ready-to-launch businesses or sell your own.',
  path: '/marketplace',
})

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children
}
