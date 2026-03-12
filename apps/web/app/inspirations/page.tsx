import InspirationsContent from './inspirations-content'

type SearchParams = {
  category?: string
  page?: string
  rev?: string
}

export default async function InspirationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  return <InspirationsContent searchParams={await searchParams} />
}
