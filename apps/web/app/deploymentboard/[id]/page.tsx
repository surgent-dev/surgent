'use client'

import { use } from 'react'
import DeploymentBoard from '@/components/deploymentboard'

export default function DeploymentBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DeploymentBoard projectId={id} />
}
