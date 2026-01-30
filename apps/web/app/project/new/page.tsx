'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateProject } from '@/queries/projects'
import { ProjectInitOverlay } from '@/components/project-init-overlay'

const projectConfigs: Record<string, { name: string; githubUrl: string; initConvex: boolean }> = {
  simple: {
    name: 'Utility',
    githubUrl: 'https://github.com/bahodirr/worker-vite-react-simple-template',
    initConvex: false,
  },
}

function NewProjectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mutateAsync } = useCreateProject()
  const startedRef = useRef(false)

  const prompt = searchParams.get('prompt') || ''
  const projectType = searchParams.get('type') || 'simple'

  useEffect(() => {
    if (startedRef.current) return
    if (!prompt) {
      router.replace('/')
      return
    }

    startedRef.current = true
    const config = projectConfigs[projectType] || projectConfigs.simple!

    mutateAsync({
      name: `${config.name} Project ${new Date().toLocaleDateString()}`,
      githubUrl: config.githubUrl,
      initConvex: config.initConvex,
    })
      .then(({ id }) => {
        router.replace(`/project/${id}?initial=${encodeURIComponent(prompt)}`)
      })
      .catch((err) => {
        console.error('Project creation failed:', err)
        const message = err?.message || 'Failed to create project'
        router.replace(`/?error=${encodeURIComponent(message)}`)
      })
  }, [prompt, projectType, mutateAsync, router])

  return (
    <div className="h-dvh w-full bg-background">
      <ProjectInitOverlay show={true} stage="creating" />
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh w-full bg-background">
          <ProjectInitOverlay show={true} stage="creating" />
        </div>
      }
    >
      <NewProjectContent />
    </Suspense>
  )
}
