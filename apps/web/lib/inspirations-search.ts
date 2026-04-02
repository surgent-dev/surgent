type RevenueFilter = {
  label: string
  value: string
  min?: number
  max?: number
}

export type InspirationsSearchParams = {
  category?: string
  page?: string
  rev?: string
}

export const INSPIRATIONS_REVENUE_FILTERS: readonly RevenueFilter[] = [
  { label: 'Top Companies', value: 'top' },
  { label: '$1k - $30k', value: '1k-30k', min: 1_000, max: 30_000 },
]

export type InspirationsQueryParams = {
  page: number
  perPage: number
  sort: string
  category?: string
  minRevenue?: number
  maxRevenue?: number
}

export function buildInspirationsQueryParams(
  searchParams: InspirationsSearchParams,
): InspirationsQueryParams {
  const revenueFilter = searchParams.rev || 'top'
  const activeRevenueFilter =
    INSPIRATIONS_REVENUE_FILTERS.find((filter) => filter.value === revenueFilter) ??
    INSPIRATIONS_REVENUE_FILTERS[0]

  return {
    page: Number(searchParams.page) || 1,
    perPage: 100,
    sort: 'revenue-desc',
    category: searchParams.category || undefined,
    minRevenue: activeRevenueFilter?.min,
    maxRevenue: activeRevenueFilter?.max,
  }
}
