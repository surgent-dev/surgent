import type { ReactNode } from 'react'

export default async function ProjectLayout({
  children,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  return <>{children}</>
}
