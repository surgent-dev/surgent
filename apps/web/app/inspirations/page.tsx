import type { Metadata } from 'next'
import { fetchStartupCategoriesServer, fetchStartupsServer } from '@/lib/api-server'
import {
  buildInspirationsQueryParams,
  type InspirationsSearchParams,
} from '@/lib/inspirations-search'
import { createPageMetadata } from '@/lib/seo'
import InspirationsContent from './inspirations-content'

export const metadata: Metadata = createPageMetadata({
  title: 'Inspirations — Startup Ideas & Revenue Data',
  description:
    'Browse real startups with verified revenue data. Get inspired, see what works, and build your own version with AI in minutes.',
  path: '/inspirations',
})

export default async function InspirationsPage({
  searchParams,
}: {
  searchParams: Promise<InspirationsSearchParams>
}) {
  const resolvedSearchParams = await searchParams
  const params = buildInspirationsQueryParams(resolvedSearchParams)
  const [initialData, initialCategories] = await Promise.all([
    fetchStartupsServer(params),
    fetchStartupCategoriesServer(),
  ])

  return (
    <InspirationsContent
      searchParams={resolvedSearchParams}
      initialData={initialData}
      initialCategories={initialCategories}
    />
  )
}
