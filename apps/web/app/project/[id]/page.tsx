import BillingSyncBridge from '@/components/billing-sync-bridge'
import ProjectView from '@/components/project-view'

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ initial?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return (
    <>
      <BillingSyncBridge />
      <ProjectView projectId={id} initialPrompt={query.initial} />
    </>
  )
}
