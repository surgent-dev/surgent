'use client'

import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useFunVibe } from '@/components/ui/fun-loading'

import type { SandboxStage } from '@/hooks/use-sandbox-ready'

type InitStage = SandboxStage

interface ProjectInitOverlayProps {
  show: boolean
  stage: InitStage
}

const stages: InitStage[] = ['creating', 'loading', 'activating', 'starting', 'ready']
const stageLabels: Record<InitStage, string> = {
  creating: 'Creating',
  loading: 'Loading',
  activating: 'Activating',
  starting: 'Starting',
  ready: 'Ready',
}

export function ProjectInitOverlay({ show, stage }: ProjectInitOverlayProps) {
  const vibe = useFunVibe(2000)
  const Icon = vibe.icon
  const isReady = stage === 'ready'
  const currentIndex = stages.indexOf(stage)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-background flex items-center justify-center"
        >
          <style jsx>{`
            @keyframes wiggle {
              0%,
              100% {
                transform: rotate(-12deg);
              }
              50% {
                transform: rotate(12deg);
              }
            }
            @keyframes float {
              0%,
              100% {
                transform: translateY(0) scale(1);
                opacity: 0.8;
              }
              50% {
                transform: translateY(-8px) scale(1.1);
                opacity: 1;
              }
            }
            @keyframes flicker {
              0%,
              100% {
                opacity: 1;
                transform: scale(1);
              }
              50% {
                opacity: 0.7;
                transform: scale(0.95);
              }
            }
            @keyframes zap {
              0%,
              100% {
                transform: translateX(0);
              }
              25% {
                transform: translateX(-3px);
              }
              75% {
                transform: translateX(3px);
              }
            }
            @keyframes rocket {
              0%,
              100% {
                transform: translateY(0) rotate(-45deg);
              }
              50% {
                transform: translateY(-8px) rotate(-45deg);
              }
            }
            @keyframes wobble {
              0%,
              100% {
                transform: rotate(0) scale(1);
              }
              25% {
                transform: rotate(-5deg) scale(1.05);
              }
              75% {
                transform: rotate(5deg) scale(1.05);
              }
            }
            @keyframes orbit {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
            @keyframes throb {
              0%,
              100% {
                transform: scale(1);
              }
              50% {
                transform: scale(1.15);
              }
            }
            @keyframes glow {
              0%,
              100% {
                opacity: 0.6;
                transform: scale(0.95);
              }
              50% {
                opacity: 1;
                transform: scale(1.1);
              }
            }
            @keyframes spin3d {
              0% {
                transform: perspective(100px) rotateY(0deg);
              }
              100% {
                transform: perspective(100px) rotateY(360deg);
              }
            }
            @keyframes rainbow {
              0%,
              100% {
                filter: hue-rotate(0deg);
                transform: scale(1);
              }
              50% {
                filter: hue-rotate(180deg);
                transform: scale(1.1);
              }
            }
          `}</style>
          <div className="flex flex-col items-center gap-6">
            <motion.div
              key={vibe.message}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={cn('text-brand', vibe.animation)}
            >
              <Icon className="h-10 w-10" weight="duotone" />
            </motion.div>
            <motion.p
              key={vibe.message + '-text'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-muted-foreground"
            >
              {isReady ? 'Ready!' : vibe.message}
            </motion.p>
            <div className="flex items-center gap-2">
              {stages.slice(0, -1).map((s, i) => {
                const isComplete = i < currentIndex
                const isCurrent = i === currentIndex
                return (
                  <div key={s} className="flex items-center gap-2">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.2 : 1,
                        opacity: isComplete || isCurrent ? 1 : 0.3,
                      }}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full transition-colors',
                        isComplete ? 'bg-brand' : isCurrent ? 'bg-brand' : 'bg-muted-foreground/30',
                      )}
                    />
                    {i < stages.length - 2 && (
                      <div
                        className={cn(
                          'h-px w-6 transition-colors',
                          isComplete ? 'bg-brand/50' : 'bg-muted-foreground/20',
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <motion.span
              key={stage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground/60"
            >
              {stageLabels[stage]}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
