import { redirect } from 'next/navigation'

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ initial?: string }>
}) {
  const [{ id }, { initial }] = await Promise.all([params, searchParams])
  redirect(`/company/${id}/editor${initial ? `?initial=${encodeURIComponent(initial)}` : ''}`)
}
