'use client'

import { motion, AnimatePresence } from 'motion/react'
import { Loader2 } from 'lucide-react'

import type { SandboxStage } from '@/hooks/use-sandbox-ready'

type InitStage = SandboxStage

interface ProjectInitOverlayProps {
  show: boolean
  stage: InitStage
}

const stageMessages: Record<InitStage, string> = {
  creating: 'Creating project...',
  loading: 'Loading project...',
  activating: 'Activating sandbox...',
  starting: 'Starting environment...',
  ready: 'Ready!',
}

export function ProjectInitOverlay({ show, stage }: ProjectInitOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-background flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-8 w-8 text-brand" />
            </motion.div>
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-muted-foreground"
            >
              {stageMessages[stage]}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
