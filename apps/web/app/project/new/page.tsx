'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateProject } from '@/queries/projects'
import { ProjectInitOverlay } from '@/components/project-init-overlay'

const projectConfigs: Record<string, { name: string; githubUrl: string; initConvex: boolean }> = {
  fullstack: {
    name: 'Fullstack',
    githubUrl: 'https://github.com/bahodirr/worker-vite-react-template',
    initConvex: true,
  },
  landing: {
    name: 'Landing',
    githubUrl: 'https://github.com/bahodirr/web-landing-starter',
    initConvex: false,
  },
  simple: {
    name: 'Utility',
    githubUrl: 'https://github.com/bahodirr/worker-vite-react-simple-template',
    initConvex: false,
  },
}

export default function NewProjectPage() {
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
        router.replace('/?error=creation_failed')
      })
  }, [prompt, projectType, mutateAsync, router])

  return (
    <div className="h-dvh w-full bg-background">
      <ProjectInitOverlay show={true} stage="creating" />
    </div>
  )
}
