'use client'

import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useFunVibe, keyframeStyles } from '@/components/ui/fun-loading'
import Link from 'next/link'
import { getProvisioningStepLabel, type ProjectProvisioningStep } from '@/lib/project-provisioning'

import type { SandboxStage } from '@/hooks/use-sandbox-ready'

interface ProjectInitOverlayProps {
  show: boolean
  stage: SandboxStage
  provisioningStep?: ProjectProvisioningStep | null
}

const stageLabels: Record<SandboxStage, string> = {
  creating: 'Creating project',
  loading: 'Loading project',
  activating: 'Activating sandbox',
  starting: 'Starting environment',
  ready: 'Ready',
  failed: 'Setup failed',
}

export function ProjectInitOverlay({ show, stage, provisioningStep }: ProjectInitOverlayProps) {
  const vibe = useFunVibe(2000)
  const Icon = vibe.icon
  const isFailed = stage === 'failed'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-white dark:bg-background flex items-center justify-center"
        >
          <style jsx>{keyframeStyles}</style>
          <div className="flex flex-col items-center gap-4">
            <motion.div
              key={vibe.message}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={cn('text-brand', vibe.animation)}
            >
              <Icon className="h-10 w-10" weight="duotone" />
            </motion.div>
            <div className="flex flex-col items-center gap-1">
              <motion.p
                key={vibe.message + '-text'}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-muted-foreground"
              >
                {isFailed ? 'Something went wrong' : vibe.message}
              </motion.p>
              <motion.span
                key={stage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                className={cn('text-xs text-muted-foreground', isFailed && 'text-destructive')}
              >
                {stage === 'creating'
                  ? getProvisioningStepLabel(provisioningStep) || stageLabels[stage]
                  : stageLabels[stage]}
              </motion.span>
              {isFailed && (
                <Link
                  href="/dashboard"
                  className="mt-3 text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Back to dashboard
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
