import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Checkout',
  description: 'Complete your purchase on Surgent.',
  path: '/checkout',
  noIndex: true, // not blocked in robots.txt so Google can see this tag
})

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
