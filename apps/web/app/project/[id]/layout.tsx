import type { ReactNode } from 'react'
import { ProjectEventProvider } from '@/context/project-events'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <ProjectEventProvider key={id} projectId={id}>
      {children}
    </ProjectEventProvider>
  )
}
