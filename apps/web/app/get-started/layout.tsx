import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Get Started',
  description:
    'Describe your business and let Surgent AI build your website, deploy a sales agent, and start growing your revenue.',
  path: '/get-started',
  noIndex: true, // not blocked in robots.txt so Google can see this tag
})

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return children
}
