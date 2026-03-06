'use client'

import ProjectView from '@/components/project-view'
import { Suspense, use } from 'react'
import { useSearchParams } from 'next/navigation'

function ProjectContent({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const initial = searchParams.get('initial') || undefined
  return <ProjectView projectId={id} initialPrompt={initial} />
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense>
      <ProjectContent id={id} />
    </Suspense>
  )
}
